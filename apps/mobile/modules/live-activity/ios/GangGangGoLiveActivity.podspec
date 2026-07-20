Pod::Spec.new do |s|
  s.name           = 'GangGangGoLiveActivity'
  s.version        = '0.2.0'
  s.summary        = 'Typed Live Activity bridge for GangGangGo.'
  s.description    = 'Local Expo module and shared ActivityAttributes for the toilet timer Live Activity.'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'GangGangGo'
  s.homepage       = 'https://localhost.invalid/gangganggo'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://localhost.invalid/gangganggo.git' }
  s.static_framework = true
  s.default_subspec = 'Module'

  s.subspec 'Attributes' do |ss|
    ss.frameworks = 'ActivityKit'
    ss.source_files = 'ToiletTimerAttributes.swift'
  end

  s.subspec 'Module' do |ss|
    ss.dependency 'ExpoModulesCore'
    ss.dependency 'GangGangGoLiveActivity/Attributes'
    ss.frameworks = 'ActivityKit'
    ss.source_files = 'GangGangGoLiveActivityModule.swift'
  end
end
