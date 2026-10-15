import Svg, { Path } from 'react-native-svg';
import { color } from './tokens';

/**
 * Phosphor icons in one place (the landing page uses Phosphor too). Use
 * weight="bold" for UI, "fill" for the active tab. Never emoji.
 */
export {
  ArrowsLeftRightIcon,
  StethoscopeIcon,
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CaretLeftIcon,
  CaretUpIcon,
  ChartLineIcon,
  ChatCircleDotsIcon,
  CloudRainIcon,
  CloudSunIcon,
  SnowflakeIcon,
  HandHeartIcon,
  LightbulbIcon,
  ListBulletsIcon,
  PaperPlaneTiltIcon,
  QuotesIcon,
  SealCheckIcon,
  SunIcon,
  TrendUpIcon,
  WifiSlashIcon,
  BarbellIcon,
  BookOpenTextIcon,
  CaretDownIcon,
  CaretRightIcon,
  ChatsCircleIcon,
  CheckIcon,
  ClockIcon,
  FlagPennantIcon,
  HouseIcon,
  LightningIcon,
  LockSimpleIcon,
  MapTrifoldIcon,
  PathIcon,
  ShuffleIcon,
  SparkleIcon,
  TargetIcon,
  UserIcon,
  XIcon,
  WarningCircleIcon,
  EnvelopeSimpleIcon,
  SignOutIcon,
  UsersThreeIcon,
  PlayIcon,
  PauseIcon,
  PencilSimpleIcon,
  CloudCheckIcon,
  CloudArrowUpIcon,
  HourglassIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  KeyboardIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  ArrowUUpLeftIcon,
  ChatTeardropTextIcon,
} from 'phosphor-react-native';

/**
 * The antelope's cloven hoofprint: two rounded teardrop halves. Used for the
 * streak (antelopes leave tracks, not flames) and the walked path.
 */
export function Hoofprint({ size = 24, tint = color.gold, rotate = 0 }: { size?: number; tint?: string; rotate?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}>
      {/* two toes, pointed toward travel, splayed a touch; inner edges straight, outer edges full */}
      <Path d="M10.2 2.2C7.1 4.6 4.4 9.4 4.5 14.3c.1 4.3 2 6.9 4.5 6.9 1.6 0 2.4-1.2 2.3-3.2l-.4-15c0-.9-.3-1.1-.7-.8Z" fill={tint} />
      <Path d="M13.8 2.2c3.1 2.4 5.8 7.2 5.7 12.1-.1 4.3-2 6.9-4.5 6.9-1.6 0-2.4-1.2-2.3-3.2l.4-15c0-.9.3-1.1.7-.8Z" fill={tint} />
    </Svg>
  );
}
