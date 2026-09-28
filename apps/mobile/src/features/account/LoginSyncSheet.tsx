import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppSheet } from '../../components/AppSheet';
import { useAppTheme } from '../../theme/themeProvider';
import { describeDisclosureFields, syncDisclosureFields } from './dataDisclosure';

const recordKinds = [
  { title: '菊花抬', fields: syncDisclosureFields.training },
  { title: '小账本', fields: syncDisclosureFields.habit },
  { title: '蹲会儿', fields: syncDisclosureFields.toilet },
  { title: '常用小信号', fields: syncDisclosureFields.signalPresets },
];

export function LoginSyncSheet({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = StyleSheet.create({
    section: { gap: 6 },
    title: { color: colors.text, fontSize: 16, fontWeight: '800' },
    body: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
    actions: { gap: 10 },
    button: { paddingVertical: 12 },
  });

  return (
    <AppSheet
      accessibilityLabel="暂不登录"
      closeLabel="取消"
      title="登录与同步"
      visible={visible}
      onClose={onClose}
      footer={
        <View style={styles.actions}>
          <AppButton onPress={onConfirm} style={styles.button}>
            继续登录并同步
          </AppButton>
          <AppButton onPress={onClose} style={styles.button} variant="secondary">
            暂不登录
          </AppButton>
        </View>
      }
    >
      <Text style={styles.body}>
        登录会将本机尚未归属账号的记录归入所选账号，并与该账号已有记录合并。请先确认要使用的账号；暂不登录也能继续在本机记录。
      </Text>
      <View style={styles.section}>
        <Text style={styles.title}>上传哪些内容</Text>
        <Text style={styles.body}>以下完整记录会上传至服务端，用于多设备同步和生成每日汇总。</Text>
        {recordKinds.map(({ title, fields }) => (
          <Text key={title} style={styles.body}>
            {title}：{describeDisclosureFields(fields)}。
          </Text>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.title}>历史范围与保留期</Text>
        <Text style={styles.body}>
          登录会上传已有的待同步记录，并补传近90天未同步的历史记录；之后的新增、修改和删除也会同步。云端按记录日期保留90天，超期记录不进入云端历史，由定时任务清理。
        </Text>
        <Text style={styles.body}>
          本机同样按90天保留健康记录，启动时会清理当前资料中的超期记录。如需长期留存，请在到期前导出账号数据。
        </Text>
        <Text style={styles.body}>仍在使用的常用小信号不随90天窗口过期，删除常用项时会同步删除。</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.title}>好友能看到什么</Text>
        <Text style={styles.body}>
          同步到自己的账号不等于分享给好友。新好友的数据权限默认关闭；只有你为某位好友选择共享类别、级别和历史范围后，TA
          才能查看相应的每日汇总。已有好友继续沿用你之前的授权。
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.title}>退出与删除</Text>
        <Text style={styles.body}>
          退出登录不会删除已同步的云端记录。你可以在“我的”导出数据或删除云端账号；删除云端账号不会自动删除本机记录。
        </Text>
      </View>
    </AppSheet>
  );
}
