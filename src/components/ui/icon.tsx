import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { icons, type IconName } from '@/constants/icon-map';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: object;
}

export function Icon({ name, size = 24, color, style }: IconProps) {
  const colors = useTheme();
  return (
    <Ionicons name={icons[name]} size={size} color={color ?? colors.text} style={style} />
  );
}
