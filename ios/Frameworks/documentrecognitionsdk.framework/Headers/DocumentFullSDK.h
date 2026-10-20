//
//  DocumentFullSDK.h
//  documentfullsdk.framework
//
//  Identixia Document Reader SDK for iOS.
//  Public API matches Android com.identixia.documentfullsdk.DocumentFullSDK.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

FOUNDATION_EXPORT double documentfullsdkVersionNumber;
FOUNDATION_EXPORT const unsigned char documentfullsdkVersionString[];

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(int, DocumentFullSDKError) {
    DocumentFullSDKSuccess = 0,
    DocumentFullSDKLicenseInvalid = 1,
    DocumentFullSDKLicenseExpired = 2,
    DocumentFullSDKNotActivated = 3,
    DocumentFullSDKInitFailed = 4,
};

__attribute__((visibility("default")))
@interface DocumentFullSDK : NSObject

+ (int)SDK_SUCCESS;
+ (int)SDK_LICENSE_INVALID;
+ (int)SDK_LICENSE_EXPIRED;
+ (int)SDK_NOT_ACTIVATED;
+ (int)SDK_INIT_FAILED;

/** faceLiveness mode: no challenge. */
+ (int)FACE_LIVENESS_PASSIVE;
/** faceLiveness mode: active challenge. */
+ (int)FACE_LIVENESS_ACTIVE;

/** Machine code for this install (…). Fingerprint is SHA256("IOS|" + bundleId). */
+ (NSString *)getMachineCode;

/**
 * Activate with an … key issued for this app's bundle identifier.
 * @return DocumentFullSDKSuccess or a license error code
 */
+ (int)setActivation:(NSString *)license;

/** Last native license error string, if setActivation failed. */
+ (NSString *)lastLicenseError;

/**
 * License tier JSON: licensed, level, levelName, recognition, authenticity, label.
 */
+ (NSString *)getLicenseStatus;

/** Last engine error from initSDK (opcode result + JSON snippet). */
+ (NSString *)lastNativeError;

/**
 * Load the engine and document database. Call after a successful setActivation.
 * Do not call on the main thread — first run loads the database.
 * Call startNewSession with scenario MrzOrOcr / FullProcess first.
 */
+ (int)initSDK;

/**
 * OCR / MRZ on a still (gallery pick or captured camera frame).
 * Call startNewSession with scenario FullProcess / MrzOrOcr first.
 * @return JSON: errorCode, documentName, ocr, mrz, images, score
 */
+ (NSString *)recognize:(UIImage *)image;
+ (NSString *)recognize:(UIImage *)image authenticity:(BOOL)authenticity;
+ (NSString *)recognize:(UIImage *)image authenticityMode:(NSString *)authenticityMode;

/** Front (+ optional back) — Linux Gallery UX for one document. */
+ (NSString *)recognizeFront:(UIImage *)front
                        back:(nullable UIImage *)back
               authenticity:(BOOL)authenticity;
+ (NSString *)recognizeFront:(UIImage *)front
                        back:(nullable UIImage *)back
           authenticityMode:(NSString *)authenticityMode;
/** @param alreadyCropped YES for camera guide crops (skip re-detect); NO for gallery stills. */
+ (NSString *)recognizeFront:(UIImage *)front
                        back:(nullable UIImage *)back
           authenticityMode:(NSString *)authenticityMode
              alreadyCropped:(BOOL)alreadyCropped;

/**
 * Document locate for live camera overlay.
 * JSON: score (0–1 or 0–100) and position.corners (LT, RT, RB, LB).
 */
+ (NSString *)locateDocument:(UIImage *)image;
+ (NSString *)locateDocument:(UIImage *)image alreadyCropped:(BOOL)alreadyCropped;

/** Open a document session. Use {"scenario":"FullProcess","series":false} before recognize. */
+ (NSString *)startNewSession;
+ (NSString *)startNewSession:(NSString *)optionsJson;
+ (NSString *)startNewPage;
+ (NSString *)deinit NS_SWIFT_UNAVAILABLE("Use deinitSDK");
+ (NSString *)deinitSDK;

/** Document authenticity / PAD on a still (OCR + authenticity). Prefer documentLiveness for PAD only. */
+ (NSString *)documentAuthenticity:(UIImage *)image;
+ (NSString *)documentAuthenticityFront:(UIImage *)front back:(nullable UIImage *)back;

/** OCR / MRZ / barcode only. Authenticity is always off. */
+ (NSString *)documentRecognition:(UIImage *)image;
+ (NSString *)documentRecognitionFront:(UIImage *)front back:(nullable UIImage *)back;
+ (NSString *)documentRecognitionFront:(UIImage *)front
                                  back:(nullable UIImage *)back
                         alreadyCropped:(BOOL)alreadyCropped;

/** Authenticity / security only. OCR / MRZ / barcode are always off. */
+ (NSString *)documentLiveness:(UIImage *)image;
+ (NSString *)documentLivenessFront:(UIImage *)front back:(nullable UIImage *)back;
+ (NSString *)documentLivenessFront:(UIImage *)front
                               back:(nullable UIImage *)back
                      alreadyCropped:(BOOL)alreadyCropped;

/**
 * Face presentation-attack detection on a portrait crop.
 * Not used by the sample Camera / Liveness screens (those use locateDocument + recognize).
 */
+ (NSString *)faceLiveness:(UIImage *)portrait mode:(int)mode;

+ (NSString *)documentProcess:(NSString *)imagesJson
                         rfid:(nullable NSString *)rfidJson
                      options:(nullable NSString *)optionsJson;

/** Alias for {@link #initSDK} (Android / cross-platform {@code init}). */
+ (int)sdkInit;
/** Alias for {@link #deinitSDK}. */
+ (NSString *)sdkDeinit;

/**
 * Android-compatible two-arg recognition / liveness names.
 * Prefer {@code documentRecognitionFront:back:} / {@code documentLivenessFront:back:}.
 */
+ (NSString *)documentRecognition:(UIImage *)front back:(nullable UIImage *)back;
+ (NSString *)documentLiveness:(UIImage *)front back:(nullable UIImage *)back;

@end

NS_ASSUME_NONNULL_END
