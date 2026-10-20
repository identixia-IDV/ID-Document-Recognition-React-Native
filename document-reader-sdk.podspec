require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -Wno-comma -Wno-shorten-64-to-32'

Pod::Spec.new do |s|
  s.name         = "document-reader-sdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/identixia-IDV/ID-Document-Recognition-Liveness-Detection-React-Native.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"

  fw_dir = File.join(__dir__, 'ios/Frameworks')
  have = File.directory?(File.join(fw_dir, 'documentrecognitionsdk.framework')) ||
    File.directory?(File.join(fw_dir, 'documentrecognitionsdk.xcframework'))
  unless have
    FileUtils.mkdir_p(fw_dir)
    zip = File.join(fw_dir, 'documentrecognitionsdk.xcframework.zip')
    system('curl', '-fsSL', '--connect-timeout', '8', '--retry', '1', '-o', zip,
           'https://github.com/identixia-IDV/ID-Document-Recognition-Liveness-Detection-iOS/releases/latest/download/documentrecognitionsdk.xcframework.zip')
    system('unzip', '-o', '-q', zip, '-d', fw_dir) if File.file?(zip)
  end

  frameworks = []
  frameworks << "ios/Frameworks/documentrecognitionsdk.framework" if File.directory?(File.join(__dir__, "ios/Frameworks/documentrecognitionsdk.framework"))
  s.vendored_frameworks = frameworks unless frameworks.empty?

  # Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
  # See https://github.com/facebook/react-native/blob/febf6b7f33fdb4904669f99d795eba4c0f95d7bf/scripts/cocoapods/new_architecture.rb#L79.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"

    # Don't install the dependencies when we run `pod install` in the old architecture.
    if ENV['RCT_NEW_ARCH_ENABLED'] == '1' then
      s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
      s.pod_target_xcconfig    = {
          "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\"",
          "OTHER_CPLUSPLUSFLAGS" => "-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1",
          "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
      }
      s.dependency "React-Codegen"
      s.dependency "RCT-Folly"
      s.dependency "RCTRequired"
      s.dependency "RCTTypeSafety"
      s.dependency "ReactCommon/turbomodule/core"
    end
  end
end
