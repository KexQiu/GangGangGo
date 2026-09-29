import { trainingDefaults, type TrainingPresetId } from '@xiaotidu/contracts';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { Screen } from '../../src/components/Screen';
import { trainingPresets } from '../../src/features/training/presets';
import { useTrainingPreferencesStore } from '../../src/features/training/trainingPreferencesStore';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrainingSettingsScreen() {
  const { colors } = useAppTheme();
  const { preferences, hasHydrated, hydrate, update, error } = useTrainingPreferencesStore();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  async function save(patch: Parameters<typeof update>[0]) {
    setBusy(true);
    setSaveError(null);
    try {
      await update(patch);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '设置保存失败');
    } finally {
      setBusy(false);
    }
  }
  function adjust(id: TrainingPresetId, key: 'contractSeconds' | 'relaxSeconds' | 'repetitions', value: number) {
    void save({ presets: { ...preferences.presets, [id]: { ...preferences.presets[id], [key]: value } } });
  }
  return (
    <Screen>
      <AppTopBar fallbackHref="/training" title="训练设置" />
      <Text style={{ color: colors.textMuted, marginBottom: 16 }}>
        以下范围是应用的设置边界，不代表医学安全范围。按个人能力或专业建议选择，以能够充分放松为前提。
      </Text>
      <AppCard style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>每日记录目标</Text>
        <Text style={{ color: colors.textMuted }}>默认不设目标。目标与提醒独立，关闭目标不会关闭已安排的提醒。</Text>
        <View style={styles.row}>
          {([null, 1, 2] as const).map((target) => (
            <AppButton
              key={String(target)}
              disabled={busy || !hasHydrated}
              variant={preferences.dailyTarget === target ? 'primary' : 'secondary'}
              onPress={() => void save({ dailyTarget: target })}
            >
              {target === null ? '关闭' : `${target} 组`}
            </AppButton>
          ))}
        </View>
      </AppCard>
      {trainingPresets.map((preset) => {
        const plan = preferences.presets[preset.id];
        const base = trainingDefaults[preset.id];
        const adjusted =
          plan.contractSeconds !== base.contractSeconds ||
          plan.relaxSeconds !== base.relaxSeconds ||
          plan.repetitions !== base.repetitions;
        return (
          <AppCard key={preset.id} style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>
              {preset.name}
              {adjusted ? ' · 已调整' : ''}
            </Text>
            {(
              [
                ['contractSeconds', '收缩秒数', 1, base.contractSeconds],
                ['relaxSeconds', '放松秒数', base.relaxSeconds, 30],
                ['repetitions', '重复次数', 1, base.repetitions],
              ] as const
            ).map(([key, label, min, max]) => (
              <View key={key} style={styles.row}>
                <Text style={{ color: colors.text, flex: 1 }}>
                  {label}：{plan[key]}
                </Text>
                <AppButton
                  accessibilityLabel={`减少${preset.name}${label}`}
                  disabled={busy || !hasHydrated || plan[key] <= min}
                  variant="secondary"
                  onPress={() => adjust(preset.id, key, plan[key] - 1)}
                >
                  −
                </AppButton>
                <AppButton
                  accessibilityLabel={`增加${preset.name}${label}`}
                  disabled={busy || !hasHydrated || plan[key] >= max}
                  variant="secondary"
                  onPress={() => adjust(preset.id, key, plan[key] + 1)}
                >
                  ＋
                </AppButton>
              </View>
            ))}
            <AppButton
              disabled={busy || !hasHydrated || !adjusted}
              variant="secondary"
              onPress={() => void save({ presets: { ...preferences.presets, [preset.id]: { ...base } } })}
            >
              恢复此预设
            </AppButton>
          </AppCard>
        );
      })}
      {(error || saveError) && (
        <Text accessibilityRole="alert" style={{ color: colors.warning }}>
          {error ?? saveError}
        </Text>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: { marginBottom: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
