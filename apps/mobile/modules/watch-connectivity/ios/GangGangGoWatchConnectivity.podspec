Pod::Spec.new do |s|
  s.name           = 'GangGangGoWatchConnectivity'
  s.version        = '0.2.0'
  s.summary        = 'Typed WatchConnectivity bridge for GangGangGo.'
  s.description    = 'Local Expo module for low-sensitivity Watch state and event acknowledgements.'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'GangGangGo'
  s.homepage       = 'https://localhost.invalid/gangganggo'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://localhost.invalid/gangganggo.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'
  s.source_files = '**/*.swift'
end
