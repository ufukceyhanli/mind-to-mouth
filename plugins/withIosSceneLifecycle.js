// Adopts the UIKit scene-based life cycle on iOS.
//
// Apps built with the iOS 27 SDK trap at launch (EXC_BREAKPOINT in
// ___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) when they
// still use the legacy UIApplicationDelegate-only life cycle. Expo SDK 57 ships
// the runtime for scenes (ExpoAppSceneDelegate, ExpoReactNativeFactoryProvider)
// but keeps its template on the legacy path, so this plugin wires it up the way
// the SDK 58 template does:
//   1. Info.plist gets a UIApplicationSceneManifest pointing at SceneDelegate.
//   2. AppDelegate conforms to ExpoReactNativeFactoryProvider and no longer
//      creates the window or starts React Native itself.
//   3. SceneDelegate.swift (a bare ExpoAppSceneDelegate subclass) is added to
//      the app target.
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const SCENE_DELEGATE_SOURCE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

const LEGACY_WINDOW_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)\s*\n#endif[ \t]*\n/;

function withSceneManifest(config) {
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return c;
  });
}

function withProviderAppDelegate(config) {
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('withIosSceneLifecycle: expected a Swift AppDelegate.');
    }
    let src = c.modResults.contents;

    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      const before = src;
      src = src.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
      if (src === before) {
        throw new Error('withIosSceneLifecycle: could not find the AppDelegate class declaration.');
      }
    }

    if (LEGACY_WINDOW_BLOCK.test(src)) {
      src = src.replace(
        LEGACY_WINDOW_BLOCK,
        '    // The window is created and React Native is started by `SceneDelegate` under the\n' +
          '    // scene-based life cycle (required by the iOS 27 SDK).\n',
      );
    } else if (src.includes('factory.startReactNative(')) {
      throw new Error('withIosSceneLifecycle: AppDelegate still starts React Native in an unexpected shape.');
    }

    c.modResults.contents = src;
    return c;
  });
}

function withSceneDelegateFile(config) {
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
      const file = path.join(c.modRequest.platformProjectRoot, projectName, 'SceneDelegate.swift');
      fs.writeFileSync(file, SCENE_DELEGATE_SOURCE);
      return c;
    },
  ]);
  return withXcodeProject(config, (c) => {
    const project = c.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
    const filepath = `${projectName}/SceneDelegate.swift`;
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: projectName, project });
    }
    return c;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  config = withSceneManifest(config);
  config = withProviderAppDelegate(config);
  config = withSceneDelegateFile(config);
  return config;
};
