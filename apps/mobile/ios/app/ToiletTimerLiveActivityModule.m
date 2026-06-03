#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ToiletTimerLiveActivityModule, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(start:(NSString *)startedAtISO
                  elapsedSeconds:(nonnull NSNumber *)elapsedSeconds
                  snapshot:(NSDictionary *)snapshot
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(pause:(NSString *)activityId
                  elapsedSeconds:(nonnull NSNumber *)elapsedSeconds
                  snapshot:(NSDictionary *)snapshot
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resume:(NSString *)activityId
                  elapsedSeconds:(nonnull NSNumber *)elapsedSeconds
                  snapshot:(NSDictionary *)snapshot
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(sync:(NSString *)activityId
                  elapsedSeconds:(nonnull NSNumber *)elapsedSeconds
                  isPaused:(BOOL)isPaused
                  snapshot:(NSDictionary *)snapshot
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(end:(NSString *)activityId
                  elapsedSeconds:(nonnull NSNumber *)elapsedSeconds
                  snapshot:(NSDictionary *)snapshot
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
