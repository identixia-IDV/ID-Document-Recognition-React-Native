#import "DocumentRecognitionSdk.h"
#import <UIKit/UIKit.h>
#include <math.h>

#if __has_include(<documentrecognitionsdk/DocumentRecognitionSDK.h>)
#import <documentrecognitionsdk/DocumentRecognitionSDK.h>
#define DRS_HAS_DOCSDK 1
#elif __has_include("DocumentRecognitionSDK.h")
#import "DocumentRecognitionSDK.h"
#define DRS_HAS_DOCSDK 1
#endif

@implementation DocumentRecognitionSdk
RCT_EXPORT_MODULE()

static void DRSWriteStatusFile(NSDictionary *payload) {
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  if (paths.count == 0) {
    return;
  }
  NSString *path = [paths[0] stringByAppendingPathComponent:@"docreader_status.json"];
  NSMutableDictionary *body = [payload mutableCopy] ?: [NSMutableDictionary dictionary];
  body[@"ts"] = @((long long)([[NSDate date] timeIntervalSince1970] * 1000.0));
  NSError *err = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:body options:NSJSONWritingPrettyPrinted error:&err];
  if (data == nil) {
    return;
  }
  [data writeToFile:path atomically:YES];
  NSLog(@"[DocReader] status file=%@ payload=%@", path, body);
}

static UIImage *DRSImageFromUriOrBase64(NSString *uriOrBase64) {
  if (uriOrBase64 == nil || uriOrBase64.length == 0) {
    return nil;
  }

  BOOL looksBase64 = [uriOrBase64 hasPrefix:@"data:"] ||
    ([uriOrBase64 length] > 256 &&
     [uriOrBase64 rangeOfString:@"://"].location == NSNotFound &&
     ![uriOrBase64 hasPrefix:@"/"] &&
     ![uriOrBase64 hasPrefix:@"file:"]);

  if (looksBase64) {
    NSString *payload = uriOrBase64;
    NSRange range = [uriOrBase64 rangeOfString:@"base64,"];
    if (range.location != NSNotFound) {
      payload = [uriOrBase64 substringFromIndex:range.location + range.length];
    }
    NSData *data = [[NSData alloc] initWithBase64EncodedString:payload options:NSDataBase64DecodingIgnoreUnknownCharacters];
    if (data == nil) {
      return nil;
    }
    return [UIImage imageWithData:data];
  }

  if ([uriOrBase64 hasPrefix:@"/"] || [uriOrBase64 hasPrefix:@"file:"]) {
    NSString *path = uriOrBase64;
    if ([path hasPrefix:@"file:"]) {
      NSURL *fileURL = [NSURL URLWithString:path];
      path = fileURL.path ?: path;
    }
    UIImage *fromFile = [UIImage imageWithContentsOfFile:path];
    if (fromFile != nil) {
      return fromFile;
    }
  }

  NSURL *url = [NSURL URLWithString:uriOrBase64];
  if (url == nil) {
    return nil;
  }
  NSData *data = [NSData dataWithContentsOfURL:url];
  if (data == nil) {
    return nil;
  }
  return [UIImage imageWithData:data];
}

static UIImage *DRSRedrawAtScale1(UIImage *image, CGSize pixelSize) {
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 1;
  format.opaque = YES;
  UIGraphicsImageRenderer *renderer =
    [[UIGraphicsImageRenderer alloc] initWithSize:pixelSize format:format];
  return [renderer imageWithActions:^(UIGraphicsImageRendererContext * _Nonnull ctx) {
    [image drawInRect:CGRectMake(0, 0, pixelSize.width, pixelSize.height)];
  }];
}

static UIImage *DRSFixOrientation(UIImage *image) {
  if (image == nil) {
    return nil;
  }
  if (image.imageOrientation == UIImageOrientationUp && image.scale == 1.0) {
    return image;
  }
  CGSize pixelSize = CGSizeMake(image.size.width * image.scale, image.size.height * image.scale);
  return DRSRedrawAtScale1(image, pixelSize);
}

/** Match native CameraViewController: landscape sensor buffer → portrait upright. */
static UIImage *DRSUprightCameraImage(UIImage *image) {
  if (image == nil) {
    return nil;
  }
  UIImage *oriented = image;
  CGFloat pw = image.size.width * image.scale;
  CGFloat ph = image.size.height * image.scale;
  if (pw > ph && image.imageOrientation == UIImageOrientationUp) {
    oriented = [UIImage imageWithCGImage:image.CGImage scale:1.0 orientation:UIImageOrientationRight];
  }
  return DRSFixOrientation(oriented);
}

static UIImage *DRSCropToGuide(UIImage *image, CGFloat viewW, CGFloat viewH, CGFloat previewW, CGFloat previewH);

static UIImage *DRSScaledMaxEdge(UIImage *image, CGFloat maxEdge) {
  if (image == nil) {
    return nil;
  }
  CGFloat pw = image.size.width * image.scale;
  CGFloat ph = image.size.height * image.scale;
  CGFloat longest = MAX(pw, ph);
  if (longest <= maxEdge || longest <= 0) {
    return image;
  }
  CGFloat factor = maxEdge / longest;
  CGSize newSize = CGSizeMake(MAX(1.0, pw * factor), MAX(1.0, ph * factor));
  return DRSRedrawAtScale1(image, newSize);
}

static NSString *DRSRescaleLocateJson(
  NSString *json,
  CGFloat locateW,
  CGFloat locateH,
  CGFloat imageW,
  CGFloat imageH
) {
  if (json.length == 0) {
    return json;
  }
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id parsed = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  if (![parsed isKindOfClass:[NSDictionary class]]) {
    return json;
  }
  NSMutableDictionary *root = [parsed mutableCopy];
  root[@"_locateImageWidth"] = @(imageW);
  root[@"_locateImageHeight"] = @(imageH);
  id posObj = root[@"position"];
  if (![posObj isKindOfClass:[NSDictionary class]]) {
    NSData *metaOnly = [NSJSONSerialization dataWithJSONObject:root options:0 error:nil];
    return metaOnly ? [[NSString alloc] initWithData:metaOnly encoding:NSUTF8StringEncoding] : json;
  }
  NSMutableDictionary *pos = [posObj mutableCopy];
  CGFloat sx = imageW / MAX(locateW, 1.0);
  CGFloat sy = imageH / MAX(locateH, 1.0);

  id corners = pos[@"corners"];
  if ([corners isKindOfClass:[NSArray class]]) {
    NSMutableArray *scaled = [NSMutableArray arrayWithCapacity:[corners count]];
    for (id item in corners) {
      if (![item isKindOfClass:[NSDictionary class]]) {
        continue;
      }
      NSDictionary *p = item;
      [scaled addObject:@{
        @"x": @([p[@"x"] doubleValue] * sx),
        @"y": @([p[@"y"] doubleValue] * sy),
      }];
    }
    pos[@"corners"] = scaled;
  } else {
    if (pos[@"left"] != nil) pos[@"left"] = @([pos[@"left"] doubleValue] * sx);
    if (pos[@"top"] != nil) pos[@"top"] = @([pos[@"top"] doubleValue] * sy);
    if (pos[@"right"] != nil) pos[@"right"] = @([pos[@"right"] doubleValue] * sx);
    if (pos[@"bottom"] != nil) pos[@"bottom"] = @([pos[@"bottom"] doubleValue] * sy);
  }
  root[@"position"] = pos;
  NSData *out = [NSJSONSerialization dataWithJSONObject:root options:0 error:nil];
  return out ? [[NSString alloc] initWithData:out encoding:NSUTF8StringEncoding] : json;
}

RCT_EXPORT_METHOD(getMachineCode:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    NSString *mc = [DocumentRecognitionSDK getMachineCode] ?: @"";
    DRSWriteStatusFile(@{ @"step": @"getMachineCode", @"machine": mc });
    resolve(mc);
#else
    reject(@"E_SDK", @"documentrecognitionsdk.framework not linked. Drop frameworks into ios/Frameworks/.", nil);
#endif
  });
}

RCT_EXPORT_METHOD(setActivation:(NSString *)license
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    int code = [DocumentRecognitionSDK setActivation:license];
    DRSWriteStatusFile(@{
      @"step": @"setActivation",
      @"code": @(code),
      @"licenseError": [DocumentRecognitionSDK lastLicenseError] ?: @""
    });
    resolve(@(code));
#else
    reject(@"E_SDK", @"documentrecognitionsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(init:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    int code = [DocumentRecognitionSDK initSDK];
    DRSWriteStatusFile(@{
      @"step": @"init",
      @"code": @(code),
      @"ready": @(code == 0),
      @"licenseError": [DocumentRecognitionSDK lastLicenseError] ?: @""
    });
    if (code == 0) {
      NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
      NSString *docs = paths.firstObject;
      NSString *frontPath = [docs stringByAppendingPathComponent:@"smoke_front.png"];
      if ([[NSFileManager defaultManager] fileExistsAtPath:frontPath]) {
        UIImage *front = [UIImage imageWithContentsOfFile:frontPath];
        NSString *backPath = [docs stringByAppendingPathComponent:@"smoke_back.png"];
        UIImage *back = [[NSFileManager defaultManager] fileExistsAtPath:backPath]
          ? [UIImage imageWithContentsOfFile:backPath]
          : nil;
        if (front != nil) {
          [DocumentRecognitionSDK startNewSession:@"{\"scenario\":\"FullProcess\",\"series\":false}"];
          NSString *json = [DocumentRecognitionSDK recognizeFront:front back:back authenticity:YES] ?: @"";
          NSDictionary *parsed = nil;
          NSData *jdata = [json dataUsingEncoding:NSUTF8StringEncoding];
          if (jdata) {
            parsed = [NSJSONSerialization JSONObjectWithData:jdata options:0 error:nil];
          }
          NSDictionary *smoke = @{
            @"step": @"smokeRecognize",
            @"ready": @YES,
            @"errorCode": parsed[@"errorCode"] ?: [NSNull null],
            @"documentName": parsed[@"documentName"] ?: [NSNull null],
            @"countryName": parsed[@"countryName"] ?: [NSNull null],
            @"score": parsed[@"score"] ?: [NSNull null],
            @"jsonLen": @(json.length),
          };
          NSString *smokePath = [docs stringByAppendingPathComponent:@"docreader_smoke.json"];
          NSData *smokeData = [NSJSONSerialization dataWithJSONObject:smoke options:NSJSONWritingPrettyPrinted error:nil];
          [smokeData writeToFile:smokePath atomically:YES];
          NSLog(@"[DocReader] smoke=%@", smoke);
        }
      }
    }
    resolve(@(code));
#else
    reject(@"E_SDK", @"documentrecognitionsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(writeStatus:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id obj = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  if ([obj isKindOfClass:[NSDictionary class]]) {
    DRSWriteStatusFile((NSDictionary *)obj);
  } else {
    DRSWriteStatusFile(@{ @"step": @"writeStatus", @"raw": json ?: @"" });
  }
  resolve([NSNull null]);
}

RCT_EXPORT_METHOD(deinit:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    [DocumentRecognitionSDK deinitSDK];
    resolve([NSNull null]);
#else
    reject(@"E_SDK", @"documentrecognitionsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(startNewSession:(NSString *)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    NSString *json = (optionsJson == nil || optionsJson.length == 0)
      ? [DocumentRecognitionSDK startNewSession]
      : [DocumentRecognitionSDK startNewSession:optionsJson];
    resolve(json ?: @"");
#else
    reject(@"E_SDK", @"documentrecognitionsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(locateDocument:(NSString *)imageUri
                  alreadyCropped:(BOOL)alreadyCropped
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    UIImage *raw = DRSImageFromUriOrBase64(imageUri);
    UIImage *image = DRSUprightCameraImage(raw);
    if (image == nil) {
      reject(@"E_IMAGE", @"Could not decode image", nil);
      return;
    }
    CGFloat imageW = image.size.width * image.scale;
    CGFloat imageH = image.size.height * image.scale;
    UIImage *locateBmp = DRSScaledMaxEdge(image, 480.0);
    CGFloat locateW = locateBmp.size.width * locateBmp.scale;
    CGFloat locateH = locateBmp.size.height * locateBmp.scale;
    NSString *json = nil;
    json = [DocumentRecognitionSDK locateDocument:locateBmp] ?: @"";
    resolve(DRSRescaleLocateJson(json ?: @"", locateW, locateH, imageW, imageH));
#else
    reject(@"E_SDK", @"documentrecognitionsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(recognize:(NSString *)frontUri
                  backUri:(NSString *)backUri
                  authenticityMode:(NSString *)authenticityMode
                  alreadyCropped:(BOOL)alreadyCropped
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    UIImage *front = DRSImageFromUriOrBase64(frontUri);
    if (front == nil) {
      reject(@"E_IMAGE", @"Could not decode front image", nil);
      return;
    }
    UIImage *back = nil;
    if (backUri != nil && backUri.length > 0) {
      back = DRSImageFromUriOrBase64(backUri);
    }
    [DocumentRecognitionSDK startNewSession:@"{\"scenario\":\"FullProcess\",\"series\":false}"];
    NSString *mode = authenticityMode.length ? authenticityMode : @"normal";
    NSString *json = nil;
    if ([DocumentRecognitionSDK respondsToSelector:@selector(recognizeFront:back:authenticityMode:alreadyCropped:)]) {
      json = [DocumentRecognitionSDK recognizeFront:front back:back authenticityMode:mode alreadyCropped:alreadyCropped];
    } else if ([DocumentRecognitionSDK respondsToSelector:@selector(recognizeFront:back:authenticityMode:)]) {
      json = [DocumentRecognitionSDK recognizeFront:front back:back authenticityMode:mode];
    } else {
      json = [DocumentRecognitionSDK recognizeFront:front back:back authenticity:![mode.lowercaseString isEqualToString:@"none"]];
    }
    resolve(json ?: @"");
#else
    reject(@"E_SDK", @"documentrecognitionsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(cropToGuide:(NSString *)imageUri
                  viewW:(nonnull NSNumber *)viewW
                  viewH:(nonnull NSNumber *)viewH
                  previewW:(nonnull NSNumber *)previewW
                  previewH:(nonnull NSNumber *)previewH
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    UIImage *raw = DRSUprightCameraImage(DRSImageFromUriOrBase64(imageUri));
    if (raw == nil) {
      reject(@"E_IMAGE", @"Could not decode image", nil);
      return;
    }
    CGFloat vw = viewW.doubleValue;
    CGFloat vh = viewH.doubleValue;
    UIImage *cropped = DRSCropToGuide(raw, vw, vh, previewW.doubleValue, previewH.doubleValue);
    if (cropped == nil) {
      reject(@"E_CROP", @"Could not crop to the camera rectangle", nil);
      return;
    }
    NSData *jpeg = UIImageJPEGRepresentation(cropped, 0.92);
    if (jpeg == nil) {
      reject(@"E_CROP", @"Could not encode cropped image", nil);
      return;
    }
    NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:
      [NSString stringWithFormat:@"dr_guide_%.0f.jpg", [[NSDate date] timeIntervalSince1970] * 1000.0]];
    if (![jpeg writeToFile:path atomically:YES]) {
      reject(@"E_CROP", @"Could not write cropped image", nil);
      return;
    }
    resolve(path);
  });
}

static UIImage *DRSCropToGuide(UIImage *image, CGFloat viewW, CGFloat viewH, CGFloat previewW, CGFloat previewH) {
  if (viewW <= 1 || viewH <= 1) {
    return nil;
  }
  CGImageRef cg = image.CGImage;
  if (cg == NULL) {
    return nil;
  }
  CGFloat pixelW = (CGFloat)CGImageGetWidth(cg);
  CGFloat pixelH = (CGFloat)CGImageGetHeight(cg);
  if (pixelW <= 8 || pixelH <= 8) {
    return nil;
  }
  CGFloat mapW = pixelW;
  CGFloat mapH = pixelH;
  if (previewW > 1 && previewH > 1) {
    CGFloat dw = previewW > previewH ? previewH : previewW;
    CGFloat dh = previewW > previewH ? previewW : previewH;
    CGFloat displayAspect = dw / dh;
    CGFloat imageAspect = pixelW / pixelH;
    if (fabs(displayAspect - imageAspect) >= 0.01) {
      if (displayAspect > imageAspect) {
        mapH = pixelW / displayAspect;
      } else {
        mapW = pixelH * displayAspect;
      }
    }
  }
  CGFloat ox = (pixelW - mapW) / 2.0;
  CGFloat oy = (pixelH - mapH) / 2.0;
  CGFloat ratio = 85.6 / 53.98;
  CGFloat fw = viewW * 0.86;
  CGFloat fh = fw / ratio;
  if (fh > viewH * 0.72) {
    fh = viewH * 0.72;
    fw = fh * ratio;
  }
  CGFloat guideLeft = (viewW - fw) / 2.0;
  CGFloat guideTop = (viewH - fh) / 2.0;
  CGFloat scale = MAX(viewW / mapW, viewH / mapH);
  CGFloat dx = (viewW - mapW * scale) / 2.0;
  CGFloat dy = (viewH - mapH * scale) / 2.0;
  CGFloat visLeft = (0.0 - dx) / scale;
  CGFloat visTop = (0.0 - dy) / scale;
  CGFloat visW = viewW / scale;
  CGFloat visH = viewH / scale;
  CGRect crop = CGRectMake(
    visLeft + visW * (guideLeft / viewW) + ox,
    visTop + visH * (guideTop / viewH) + oy,
    visW * (fw / viewW),
    visH * (fh / viewH)
  );
  crop = CGRectIntegral(crop);
  crop = CGRectIntersection(crop, CGRectMake(0, 0, CGImageGetWidth(cg), CGImageGetHeight(cg)));
  if (crop.size.width < 32 || crop.size.height < 32) {
    return nil;
  }
  CGImageRef cut = CGImageCreateWithImageInRect(cg, crop);
  if (cut == NULL) {
    return nil;
  }
  UIImage *out = [UIImage imageWithCGImage:cut scale:1.0 orientation:UIImageOrientationUp];
  CGImageRelease(cut);
  return out;
}

RCT_EXPORT_METHOD(documentRecognition:(NSString *)frontUri
                  backUri:(NSString *)backUri
                  alreadyCropped:(BOOL)alreadyCropped
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  DRSProcessStill(frontUri, backUri, NO, alreadyCropped, resolve, reject);
}

RCT_EXPORT_METHOD(documentLiveness:(NSString *)frontUri
                  backUri:(NSString *)backUri
                  alreadyCropped:(BOOL)alreadyCropped
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  DRSProcessStill(frontUri, backUri, YES, alreadyCropped, resolve, reject);
}

static void DRSProcessStill(NSString *frontUri,
                            NSString *backUri,
                            BOOL livenessOnly,
                            BOOL alreadyCropped,
                            RCTPromiseResolveBlock resolve,
                            RCTPromiseRejectBlock reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    UIImage *front = DRSImageFromUriOrBase64(frontUri);
    if (front == nil) {
      reject(@"E_IMAGE", @"Could not decode front image", nil);
      return;
    }
    UIImage *back = nil;
    if (backUri != nil && backUri.length > 0) {
      back = DRSImageFromUriOrBase64(backUri);
    }
    NSString *scenario = livenessOnly
        ? @"{\"scenario\":\"FullAuth\",\"series\":false}"
        : @"{\"scenario\":\"FullProcess\",\"series\":false}";
    [DocumentRecognitionSDK startNewSession:scenario];
    NSString *json = nil;
    if (livenessOnly) {
      if ([DocumentRecognitionSDK respondsToSelector:@selector(documentLivenessFront:back:alreadyCropped:)]) {
        json = [DocumentRecognitionSDK documentLivenessFront:front back:back alreadyCropped:alreadyCropped];
      } else if ([DocumentRecognitionSDK respondsToSelector:@selector(documentLivenessFront:back:)]) {
        json = [DocumentRecognitionSDK documentLivenessFront:front back:back];
      } else {
        json = [DocumentRecognitionSDK documentAuthenticityFront:front back:back];
      }
    } else if ([DocumentRecognitionSDK respondsToSelector:@selector(documentRecognitionFront:back:alreadyCropped:)]) {
      json = [DocumentRecognitionSDK documentRecognitionFront:front back:back alreadyCropped:alreadyCropped];
    } else if ([DocumentRecognitionSDK respondsToSelector:@selector(documentRecognitionFront:back:)]) {
      json = [DocumentRecognitionSDK documentRecognitionFront:front back:back];
    } else {
      json = [DocumentRecognitionSDK recognizeFront:front back:back authenticityMode:@"none"];
    }
    resolve(json ?: @"");
#else
    reject(@"E_SDK", @"documentrecognitionsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(lastLicenseError:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
#ifdef DRS_HAS_DOCSDK
  resolve([DocumentRecognitionSDK lastLicenseError] ?: @"");
#else
  resolve(@"");
#endif
}

RCT_EXPORT_METHOD(getLicenseStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
#ifdef DRS_HAS_DOCSDK
  if ([DocumentRecognitionSDK respondsToSelector:@selector(getLicenseStatus)]) {
    resolve([DocumentRecognitionSDK getLicenseStatus] ?: @"{}");
  } else {
    resolve(@"{}");
  }
#else
  resolve(@"{}");
#endif
}

@end
