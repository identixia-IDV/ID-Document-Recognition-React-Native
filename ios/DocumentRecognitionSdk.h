
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNDocumentRecognitionSdkSpec.h"
@interface DocumentRecognitionSdk : NSObject <NativeDocumentRecognitionSdkSpec>
#else
#import <React/RCTBridgeModule.h>
@interface DocumentRecognitionSdk : NSObject <RCTBridgeModule>
#endif
@end