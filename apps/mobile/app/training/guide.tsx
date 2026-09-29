import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { Screen } from '../../src/components/Screen';
import { useTrainingPreferencesStore } from '../../src/features/training/trainingPreferencesStore';
import { trainingEligibilityGuidance, trainingSafetyGuidance } from '../../src/features/safety/healthGuidance';
import { useAppTheme } from '../../src/theme/themeProvider';
import { isTrainingPresetId } from '../../src/features/training/presets';
export default function TrainingGuideScreen() {
  const router = useRouter();
  const { presetId } = useLocalSearchParams<{ presetId?: string }>();
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function confirm() {
    setSaving(true);
    try {
      await useTrainingPreferencesStore.getState().update({ onboardingSeen: true });
      router.replace(isTrainingPresetId(presetId) ? `/training/session?presetId=${presetId}` : '/training');
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Screen>
      <AppTopBar fallbackHref="/training" title="先了解动作" />
      <View style={{ gap: 16 }}>
        {[
          trainingEligibilityGuidance,
          '想象轻轻忍住排气，感觉盆底向内、向上提起。保持正常呼吸，不夹臀、不收腹、不向下用力。不要反复中断排尿来练习。',
          '收缩后完全松开。如果不能判断是否用对肌肉，或无法充分放松，请先咨询盆底康复专业人员。',
          trainingSafetyGuidance,
        ].map((text) => (
          <AppCard key={text}>
            <Text style={{ color: colors.text, lineHeight: 24 }}>{text}</Text>
          </AppCard>
        ))}
        <Text style={{ color: colors.textMuted }}>阅读说明仅表示了解操作，不代表已完成医学筛查。</Text>
        <AppButton disabled={saving} onPress={() => void confirm()}>
          {isTrainingPresetId(presetId) ? '已了解，开始准备' : '已了解，选择节奏'}
        </AppButton>
        {error && (
          <Text accessibilityRole="alert" style={{ color: colors.warning }}>
            {error}
          </Text>
        )}
      </View>
    </Screen>
  );
}
