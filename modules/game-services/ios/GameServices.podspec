Pod::Spec.new do |s|
  s.name           = 'GameServices'
  s.version        = '1.0.0'
  s.summary        = 'Game Center bridge for ShowDown'
  s.description    = 'Achievements and leaderboards via GameKit'
  s.author         = 'ShowDown'
  s.homepage       = 'https://showdown.lebene.pl'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'GameKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
