import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type MenuAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * The menu behind a "more" (three dots) button. Native on each platform: an
 * action sheet on iOS, an alert with one button per action elsewhere. Add an
 * entry to the list to extend the menu; Cancel is always appended.
 */
export function showActionMenu(actions: MenuAction[], title?: string) {
  if (Platform.OS === 'ios') {
    const destructive = actions.flatMap((a, i) => (a.destructive ? [i] : []));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...actions.map((a) => a.label), 'Cancel'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: destructive.length > 0 ? destructive : undefined,
        userInterfaceStyle: 'light',
      },
      (index) => actions[index]?.onPress(),
    );
    return;
  }
  Alert.alert(title ?? '', undefined, [
    ...actions.map((a) => ({
      text: a.label,
      style: a.destructive ? ('destructive' as const) : ('default' as const),
      onPress: a.onPress,
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
