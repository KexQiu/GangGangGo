# 健康内容与文案规范

资料核对日期：2026-09-29。适用范围：一般成人健康教育与习惯记录。此次为资料与代码核对，尚未完成临床专业人员审校或本次原生版本的真机验收。

本文是当前健康文案依据，替代 v0.1/v0.2 历史设计中“统一达标”“建议量”等表述。历史文档保留版本背景，不应直接复用为现行健康建议。

## 当前表达规则

- “菊花抬”“蹲会儿”“小账本”可保留为功能名称。适用条件、就医指引、权限和删除等关键操作使用明确术语。
- 区分日常咨询、及时就医和立即急诊。持续或大量出血、出血伴头晕/晕厥/明显虚弱、便血伴剧烈腹痛应直接给出急诊指引，阅读 App 说明和完成记录不作为前置条件。
- 不自行将便血判断为痔疮。记录选项覆盖血迹，不以“明显”作为记录或求助门槛。黑色柏油样、深红色或带血的便应及时就医评估；也需说明食物、药物可能改变颜色。
- 盆底收缩训练并非人人适合。盆底疼痛、排尿排便困难、已知盆底过紧时先咨询专业人员；术后、孕产期按专业建议安排。正常呼吸、避免代偿、收缩后充分放松，疼痛或症状加重时停练。
- 3 秒、5 秒和短收缩是节奏名称，不是新手/标准/快速疗效等级。每天 2 组仅为应用记录目标，不是个体训练处方；不能因未完成目标鼓励额外加练。
- 饮水分档记录约 200 mL 一杯的数量，不表示越多越好。1500–1700 mL/天的参考必须同时说明温和气候、低活动量成年人等条件；限液者按医嘱，高温与大量活动等情况需调整。
- “蔬果与全谷”只粗略描述饮食构成，不能以有蔬菜的餐次认定实际纤维摄入达标。
- 活动记录统计累计时长，多次活动可相加，短暂起身只计实际活动时间；不据此断言达到 WHO 的整体运动建议。
- 排便频率因人而异，不要求每天排便。“今日未排便”与“困难”和“未记录”分别表达。持续改变或伴疼痛、便血时寻求专业评估。
- 四项记满是记录完整，不代表健康达标。手机、好友页和手表使用相同的含义。
- 5/10/15/20 分钟仅是如厕提醒节点，不是医学安全线或坐满目标。达到 10 分钟作为应用“较久记录”的统计和结束页提醒口径，避免“肌肉已过劳”等无法由计时器判断的断言。
- “通知暗号”仅覆盖训练和久坐本地提醒。好友通知、如厕阶段提醒、锁屏和灵动岛不受该开关控制，应明确告知范围。

## 记录状态与实现边界

- `habit.bowel` 新增 `not_today`，表示“今日未排便”。其他三项仍只允许 `low/medium/good/null`。
- `null` 表示未记录；`not_today` 计入记录完整度和连续记录天数，不表示便秘或训练失败。
- SQLite/Postgres 字段为文本，无需数据库结构迁移。写入、本地重新读取、outbox、云同步、每日汇总和好友完整共享均保留新状态。
- 手表现有 `*Done` 布尔字段表示“已有记录”，显示“已记录”，不表示 `good` 或医学达标。手表空项仍按所示分档快捷填写；其他分档和“今日未排便”在手机填写。已记录项点按撤销。
- 颜色选项为“棕色”和“其他或不确定”，分别使用现有 `normal/attention` 存储值。后一项只触发解释与条件式就医提醒，不自动诊断颜色异常或病因。

## 来源与适用条件

| 主题 | 主要来源 | 应用方式 |
| --- | --- | --- |
| 盆底训练 | [NIDDK：Kegel Exercises](https://www.niddk.nih.gov/health-information/urologic-diseases/kegel-exercises)、[Cleveland Clinic：Kegel Exercises](https://my.clevelandclinic.org/health/articles/14611-kegel-exercises) | 适用性、充分放松、正确动作与个体化安排；不能将示例次数变成所有人的固定处方。 |
| 便血与急诊信号 | [NHS：Rectal bleeding](https://www.nhs.uk/symptoms/bleeding-from-the-bottom-rectal-bleeding/)、[Mayo Clinic：Rectal bleeding](https://www.mayoclinic.org/symptoms/rectal-bleeding/basics/causes/sym-20050740) | 按症状区分紧急程度，使用当地急诊/急救表述，不直接搬用英国服务号码。 |
| 如厕习惯 | [NIDDK：Hemorrhoids symptoms and causes](https://www.niddk.nih.gov/health-information/digestive-diseases/hemorrhoids/symptoms-causes) | 避免久坐马桶和持续用力；该资料不为应用的分钟分档提供医学安全界限。 |
| 饮水 | [中国居民膳食指南（2022）：规律进餐，足量饮水](https://dg.cnsoc.org/article/04/wDCyy7cWSJCN6pwKHOo5Dw.html)、[NIDDK：CKD 饮食与液体](https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/healthy-eating-adults-chronic-kidney-disease) | 保留温和气候、低身体活动量等条件；需限液的人遵循个人医嘱。 |
| 饮食构成 | [国家卫健委：膳食纤维与膳食指南说明](https://www.nhc.gov.cn/wjw/jiany/202301/bd6c614391274ebd955fc9018f2032a2.shtml) | 餐次仅作为粗略记录，不推算实际纤维摄入量。 |
| 活动 | [WHO：身体活动与久坐指南](https://www.who.int/europe/publications/i/item/9789240014886) | 运动建议包含强度和每周累计量，不能由几次起身或一个日时长分档判定整体达标。 |
| 排便频率 | [University Hospitals Sussex NHS：Constipation](https://www.uhsussex.nhs.uk/resources/constipation-ed/) | 不要求每天排便；结合个人既往习惯及持续变化、伴随症状理解记录。 |

## 验证与后续维护

自动检查覆盖新状态的存储、读取、outbox、下载落库、汇总、共享契约和其他字段拒绝非法状态。Postgres 集成用例需通过 `DATABASE_URL` 配置专用测试数据库才运行，未运行时不能视为真实服务联调通过。

真机需复查：小屏幕和放大字体下健康提示完整可读；手机低档记录同步手表后只显示“已记录”；“今日未排便”跨设备回看保持原意；结束记录和训练完成页可直接看到就医信息；关闭通知暗号不改变其他通知的独立设置。

调整健康建议时同步修改正文、来源、适用条件和核对日期。新增疗效或疾病相关建议前需由相应专业人员审校；资料核对日期不应标成医生审核日期。
