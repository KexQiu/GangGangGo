Pod::Spec.new do |s|
  s.name           = 'GangGangGoStorageProtection'
  s.version        = '0.2.0'
  s.summary        = 'iOS local data protection for GangGangGo.'
  s.description    = 'Applies file protection and iCloud backup exclusion to local SQLite data.'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'GangGangGo'
  s.homepage       = 'https://localhost.invalid/gangganggo'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://localhost.invalid/gangganggo.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
