import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';


type Props = {
  size?: number;
  style?: ViewStyle;
  onPress?: () => void;
};


export default function IdentixiaLogo({ style, onPress }: Props) {
  const image = (
    <Image
      source={require('../assets/ic_identixia.png')}
      style={{ width: '100%', height: 72 }}
      resizeMode="contain"
      accessibilityLabel="Identixia"
    />
  );


  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.wrap, style]}
        accessibilityRole="button"
        accessibilityLabel="Identixia"
      >
        {image}
      </TouchableOpacity>
    );
  }


  return <View style={[styles.wrap, style]}>{image}</View>;
}


const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', width: '100%' },
});
