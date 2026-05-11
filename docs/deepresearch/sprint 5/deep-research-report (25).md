# BuyerRecon Sprint 5 深度研究报告

BuyerRecon 这一轮不该参考“客户看板”去做，而该参考“内部学习操作系统”去做：把版本化评分、可复现证据、人工裁决、延迟结果回填、校准与回滚治理放在同一个内部工作台里。公开资料里最稳定、最可复用的模式，不是更多图表，而是把**上线控制**、**分析解释**、**人工审核**、**结果反馈**与**版本治理**明确拆开，再用官方/草稿空间、验证状态、实验假设、回看对比与审计日志把它们串起来。citeturn28view3turn24view9turn24view8turn23view0turn24view2turn27view2turn23view6turn23view7

## 执行摘要

### 内部学习十条

1. **内部学习系统的主目标应是“决策质量提升速度”，不是“自助分析覆盖率”。** 公开对标里，实验工具强调假设、纳入条件、共享指标，风控工具强调审核与判定，模型监控工具强调延迟真值与切片排障；这些都比普通行为图表更接近 BuyerRecon 的核心任务。citeturn24view8turn28view3turn27view1turn23view3turn24view2turn29view9

2. **必须把“官方口径”与“草稿探索”分开。** Metabase 明确区分 Official collections、verified items、个人集合；Looker 用 folder/role/data access 组合来区分谁能看、谁能改、谁能看底层数据。citeturn27view9turn23view0turn25view9turn25view8turn23view2

3. **每次变更都要有版本与谱系。** MLflow 的 runs、artifacts、registry lineage/aliasing，以及 W&B 的 experiment tracking、registry、report，都说明“改了什么、为什么改、结果怎样、怎么回滚”应是第一等公民。citeturn23view6turn23view7turn31view0turn28view10turn28view11turn31view1

4. **人工审核不是补丁，而是学习闭环的一部分。** Persona 的 Cases、LangSmith 的 annotation queues、Phoenix 的 rubric annotations、Label Studio 的 review/annotator dashboards 都把人工反馈设计成结构化输入，而不是离散备注。citeturn27view2turn24view3turn31view3turn31view5turn26view9turn23view8

5. **没有 delayed actuals，就没有可用的 BuyerRecon 校准系统。** Arize 与 WhyLabs 都把“延迟到达的真值/部分真值”作为生产环境常态来处理。citeturn24view2turn24view0turn20search4

6. **切片排障优先于全局平均分。** Arize 的 performance tracing、WhyLabs 的 global/segment feature importance、Evidently 的 reference-vs-current 比较都指向同一个结论：发现“哪个切片坏了”比看一个总体 accuracy 更重要。citeturn29view9turn27view11turn26view1turn26view2

7. **数据质量要像代码一样被测试、失败、记录与文档化。** dbt 把 failing rows 视作测试输出，GX 把 validation 结果转成文档，Soda 用 YAML 式 checks 和结果状态做持续监控。citeturn30view3turn27view7turn30view6turn26view5turn26view4

8. **反馈要结构化到能统计，也要保留自由文本。** HubSpot survey response properties、Humanloop human evaluators、Phoenix annotation types 都是“结构化字段 + 备注”的组合，而不是二选一。citeturn24view11turn27view4turn22search7turn31view4turn31view5

9. **回滚要先于自动优化。** PostHog、Mixpanel、Statsig、LaunchDarkly 都把 flags/overrides/holdouts/kill-switch 放在实验系统核心位置，说明 BuyerRecon 在数据量尚小的阶段更应强调安全可退，而不是自动调参。citeturn25view4turn24view9turn26view7turn24view7

10. **BuyerRecon 的内部系统应优先积累“已验证 buyer-motion outcome + 裁决理由 + 版本差异”的专有知识，而不是再造一个通用 analytics 产品。** 通用 cohorts/funnels/path 已被分析平台标准化；可防守的资产更接近风控/审核/模型治理里的 outcome memory。citeturn25view7turn28view0turn28view1turn24view6turn27view1turn27view2turn23view7

### Knob 仪表盘十条

1. **v1 只暴露高杠杆 knobs。** 应先做阈值带、人工复审带、来源信任权重、时效衰减、缺失数据惩罚、升级路由与 shadow/holdout 比例；不要一上来暴露几十个自由权重。公开工具最稳定的 knobs 也都集中在阈值、分流、覆盖比例、环境隔离与局部配置上。citeturn27view1turn28view4turn25view4turn26view8

2. **每次 knob 变更都必须带假设。** PostHog 与 Statsig 都要求 hypothesis/goal metric 先定义，再谈实验判断。citeturn24view8turn26view8

3. **“测试 override”不得污染正式分析。** Statsig 明确说 overrides 不进入 Pulse 分析；PostHog 明确说浏览器 override 不影响后端 flag evaluation。citeturn26view7turn24view9

4. **Knob 变更要做固定语料回放，而不是只看实时流量。** MLflow compare runs、Arize compare A/B、Evidently reference/current comparison 都支持同一批样本的前后对比。citeturn31view0turn29view11turn26view0turn26view1

5. **要有 program-level holdout。** LaunchDarkly 与 Statsig 都把 holdout 视为衡量“整个实验/功能项目总体影响”的手段，而不仅是单一变体比较。citeturn24view7turn25view1

6. **要有 mutually-exclusive layers。** Statsig layers 说明相互有干扰的实验要先做层隔离，否则无法解释影响来源。citeturn25view0

7. **要有 prod / shadow / sandbox 三层。** Mixpanel 建议开发环境独立 project；Metabase 建议在非生产实例测试 serialization 过程。citeturn24view5turn23view1

8. **Knob 配置必须脱离代码硬编码。** PostHog 的 remote config 与 flags endpoint、MLflow registry aliasing 都说明“运行时配置”和“代码发布”不应耦合。citeturn28view4turn28view6turn23view7

9. **阈值变化必须预估队列冲击。** 风控工具公开资料里，阈值、review rules、assignment、SLA 是一个系统，而不是孤立按钮。citeturn23view3turn27view1turn23view4

10. **回滚必须是别名切换，不是人工 SQL 修补。** Model registry alias、feature flag kill-switch、serialized dashboard assets 说明最稳妥的回滚是指针回退与版本回放。citeturn23view7turn25view4turn23view1

### 客户案例学习十条

1. **每个客户案例都必须成为一个独立 case object。** 很多最有用的模式不是 report，而是 case。citeturn27view2turn24view3

2. **Case 要带 checklist、comments、attachments。** 只留一个 disposition 不足以沉淀可复用学习。citeturn24view3

3. **FP 与 FN 必须分队列看。** 风控产品用“review queue + outcome feedback”，模型监控产品用“performance degradation + delayed actuals”；BuyerRecon 应把“打扰真实客户”和“错过真实 buyer”视作两种不同损失。citeturn23view3turn27view1turn24view2

4. **原因标签必须既可枚举，也能写备注。** Phoenix 支持 categorical / continuous / freeform；Humanloop 也建议为不同反馈类型设置 evaluator schema。citeturn31view5turn22search7

5. **每个 case 必须最终绑定 outcome。** 没有最终 outcome 的 case 只能是观察，不是学习。HubSpot 把 survey response 作为可分组、可触发 workflow、可报表的对象；Arize 把 actuals 回写到 prediction ID。citeturn27view4turn24view2

6. **要能比较 cohort，而不是只看孤立案例。** Amplitude 与 Mixpanel 都把 cohort comparison 作为理解差异的基础模式。citeturn24view10turn28view1turn28view2

7. **要支持 pairwise/side-by-side 审核。** LangSmith 明确支持 pairwise annotation queues；这很适合 BuyerRecon 做 reason-code 或版本优劣比较。citeturn31view3

8. **要用 SLA 管队列，不要靠“有空再看”。** Persona 官方案例分析直接给 resolution time 分位数与 team/person 过滤。citeturn23view4

9. **重复出现的案例结论要提升为“官方 insight”，不能永久埋在 case notes 里。** Metabase 的 official/verified 与 GX 的 Data Docs 都在做“把一次性发现升级为团队可追溯知识”。citeturn27view9turn27view8turn30view6

10. **Sales/CS 反馈必须映射成固定 taxonomy。** 否则它只能当 CRM 备注，不能反哺 scoring。HubSpot 允许自定义 feedback properties 并直接进报告/segment/workflow。citeturn24view11turn27view4turn27view5

### 数据护城河十条

1. **可防守数据不是“谁来过网站”，而是“哪些证据组合最终对应了真实 buyer motion”。** 通用 analytics 对 cohorts/funnels/path 的支持已经高度标准化。citeturn25view7turn24view6turn28view0turn28view1turn28view2

2. **负样本知识同样是 moat。** Stripe Radar 明确把商户标记 fraudulent 的反馈喂回模型；BuyerRecon 也应珍惜“为什么它不是 buyer”的标签。citeturn27view1

3. **理由层比分数层更能沉淀知识。** 风控里的 risk insights、Phoenix/Arize 的 annotation rubrics、Persona checklists 都在把“为什么这么判”结构化。citeturn27view0turn31view5turn31view6turn24view3

4. **要尽可能收集可回放的衍生特征和证据引用，而非无限制原始数据。** WhyLabs 公开写明默认传统计 profile 而非 raw data；Soda 也强调默认只扫质量指标。citeturn27view10turn26view4

5. **所有下游用途都要反向挂回上游资产。** dbt exposures 的价值就在于把 dashboard / app / pipeline 等下游消费声明出来。citeturn23view10turn27view6

6. **护城河离不开 re-verification 规则。** Metabase 明确规定 query 变更后 question/model verification 失效；BuyerRecon 也应对评分逻辑变化触发“重新确认”。citeturn23view0turn27view8

7. **要有“官方特征/指标库”，否则没有团队记忆。** Metabase Library collection 与 saved metrics 是很直接的内部模式。citeturn25view10turn27view9

8. **护城河来自 outcome-confirmed memory，不来自 feature sprawl。** MLflow/W&B registry 强调 lineage 与 lifecycle，不是盲目扩充参数。citeturn23view7turn28view11

9. **要把 customer outcome feedback 变成结构化对象。** HubSpot survey response properties 的价值，不是问卷本身，而是它能成为 segment/workflow/report 的基础对象。citeturn24view11turn27view4

10. **隐私约束本身也是 moat 设计的一部分。** 公开监控工具反复说明“少传 raw，多传 profile / metrics / failing rows / artifacts”；BuyerRecon 若能在不滥采数据的情况下持续提升判断质量，会比简单堆采集更可持续。citeturn27view10turn26view4turn30view6

### 主要风险十条

1. **先做 UI，后做 label schema。** 这会让 later feedback 不可比较。citeturn31view5turn24view3  
2. **把 threshold/weights 写死在代码里。** 这会直接破坏回滚与审计。citeturn28view4turn23view7  
3. **只看总体 score，不看切片。** 会掩盖高价值客户群体上的系统性错误。citeturn29view9turn27view11  
4. **把实验 override 计入正式分析。** 会污染判断。citeturn26view7turn24view9  
5. **把 notes 当成唯一反馈通道。** 会丢失统计能力。citeturn22search7turn27view4  
6. **没有 delayed actuals 设计。** 最后无法校准。citeturn24view2turn24view0  
7. **没有官方/草稿分层。** 团队会在错误报表上做决策。citeturn27view9turn23view0  
8. **没有数据合同与 failing-row 测试。** 你会把坏数据当作模型退化。citeturn30view3turn30view6turn26view4  
9. **没有一键回滚。** 每次上线都会被放大成信任风险。citeturn23view7turn25view4  
10. **把原始 clickstream 当 moat。** 这会让 BuyerRecon 向通用 analytics 同质化。citeturn25view7turn28view0turn24view6

**Fact**：公开对标里，最成熟的内部学习系统都围绕“版本、证据、队列、反馈、权限、回滚”构建，而不是围绕“多几个图表”构建。citeturn23view6turn23view7turn27view2turn23view0turn24view2turn26view4

**Inference**：BuyerRecon 的内核应更接近风控审核台与模型治理台的混合体，而不是 PostHog/GA4 式客户分析前台。citeturn27view1turn23view3turn29view9turn24view6turn25view7

**Recommendation**：Sprint 5 的最小可行目标应是做出“官方学习系统骨架”——有版本化 knobs、有 FP/FN 队列、有 replay、有 outcome backfill、有 official metrics。citeturn23view7turn23view3turn24view2turn27view9

**Open decision for Helen**：v1 是否坚持“可解释加权 scorecard + calibrated thresholds”为主、把轻量模型作为 shadow challenger；这会决定 Sprint 5 的 UI 深度、审核方式与回滚复杂度。citeturn30view0turn23view7turn29view11

## 对标矩阵

| 产品/领域 | 相关模式 | 校准/实验模式 | 人工审核模式 | 反馈闭环模式 | 数据护城河相关性 | 对 BuyerRecon 适用性 | 来源 | 置信度 |
|---|---|---|---|---|---|---|---|---|
| urlPostHogturn19search18 | feature flags + experiments + remote config | hypothesis、metrics、inclusion criteria；metrics 只影响分析；browser override 不污染 backend；remote config 独立于代码部署 | 以 operator testing 为主，不是 case review 系统 | experiment metrics / shared metrics / early access | 对 moat 本身弱，但对“配置与分析分离”非常强 | **很高**：适合做 knob dashboard、shadow、回滚与安全发布 | citeturn24view8turn28view3turn24view9turn28view4turn28view6 | 高 |
| urlAmplitudeturn14search16 | cohorts 可跨 charts/dashboards 复用 | feature/web experiments 与 flags 一体；cohort comparison；cohort population over time | 人工审核弱 | cohort 变化与差异分析 | moat 中等：段落记忆强，证据判定弱 | **中高**：适合“客户结果/误报切片比较” | citeturn25view2turn25view3turn24view10turn28view2 | 高 |
| urlMixpanelturn1search18 | funnels、cohorts、flags | flags 负责 rollout；experiments 负责 rigor；dev/prod 数据分离 | 人工审核弱 | cohort sync / share / compare | moat 较弱，但环境隔离模式很有价值 | **高**：适合“实验决策”和“开发环境隔离” | citeturn28view0turn28view1turn25view4turn25view5turn24view5 | 高 |
| urlGoogle Analytics 4 Explorationsturn0search7 | explorations、funnel、path | 深入路径/漏斗探索，但偏行为解释 | 无 | 行为洞察闭环 | moat 低：通用分析模式 | **中等偏低**：适合路径分析心智，不适合 BuyerRecon 核心学习引擎 | citeturn25view6turn25view7turn24view6turn15search0 | 高 |
| urlLookerturn2search16 | folder + role + data access 治理 | BI 层的官方内容治理 | 无 | governed BI | moat 在治理层，不在评分层 | **高**：适合 founder / product / sales 的权限隔离 | citeturn25view8turn23view2 | 高 |
| urlMetabaseturn16search6 | official collections、verified items、Library metrics、serialization、usage analytics | query 变更触发 re-verification；staging/version-control workflow；usage analytics 看内部内容使用 | 无 | usage analytics + official metrics/library | **高**：团队记忆、官方口径、知识固化都很强 | **很高**：最适合作为 BuyerRecon internal BI 与 official/scratch 分层范式 | citeturn27view9turn23view0turn23view1turn25view10turn29view1 | 高 |
| urlStripe Radarturn3search5 | risk score、risk insights、review queue、rules | 0–99 risk score；review/block/allow actions；merchant feedback 反馈到模型 | review queue、self-assignment、risk factor list | fraud disposition 反哺模型 | **高**：说明护城河来自 outcome labels + reasons | **很高**：FP/FN review、reason-code 与阈值带设计的最佳公开模式之一 | citeturn27view1turn23view3turn27view0 | 高 |
| urlPersona Casesturn13search0 | configurable case UI、checklist、comments、attachments、analytics、automation | workflow tags/automation 可减少人工时间 | 强：case review 是产品中心 | case SLA、resolution time、third-party data ingestion | **高**：Reviewed case corpus 非常接近 BuyerRecon moat 形态 | **很高**：最适合 case learning loop / human review queue | citeturn27view2turn24view3turn23view4turn27view3 | 高 |
| urlArize AX Docsturn10search1 | model performance templates、compare A/B、delayed actuals、performance tracing、SHAP | 版本比较、切片性能、actuals 回填、全局重要性 | 通过 annotation configs / Phoenix 支持结构化反馈 | label & eval datasets 促进模型改进 | 高 | **很高**：最适合 model/version compare、feature performance、delayed outcomes | citeturn24view2turn29view9turn29view10turn29view11turn29view8 | 高 |
| urlWhyLabsturn4search5 | profile-based monitoring、custom metrics、delayed/partial ground truth、feature importance | drift + performance + custom KPI | 审核本身不强 | metric-based monitoring loop | **很高**：默认不收 raw data 的模式对 BuyerRecon 很关键 | **高**：适合 privacy-aware monitoring 与 feature health | citeturn24view0turn24view1turn27view10turn27view11turn23view5 | 高 |
| urlMLflowturn4search15 | runs、experiments、artifacts、registry、alias、lineage | run/model compare；search/filter/group | 无原生队列 | lifecycle governance | **高**：组织记忆与回滚基座很强 | **很高**：最适合 improvement log / registry / rollback alias | citeturn23view6turn23view7turn31view0 | 高 |
| urlWeights & Biasesturn9search12 | experiment tracking、reports、registry、workspace/report API | hyperparameter / artifact tracking；reports publish/share | 队列弱 | collaborative reports + webhooks | 中高：团队协作与实验叙事强 | **高**：适合 internal experiment dashboard 与 founder memo | citeturn28view10turn28view11turn31view1turn31view2 | 中高 |
| urlEvidentlyturn4search18 | open-source reports + tests + monitoring | classification preset、data drift、data summary、reference/current compare | 无原生队列 | exportable reports/test suites | **高**：低成本可复现评估栈 | **很高**：早期低数据量阶段尤其适合 BuyerRecon 做 replay 与校准 | citeturn26view0turn26view1turn26view2turn26view3 | 高 |
| urlLabel Studioturn29view5 | open-source labeling + AI evaluation + reviewer/annotator analytics | active learning / pre-label / review-refine | 强 | annotations 改善训练数据与评估质量 | **高**：高质量人工标签可积累为专有资产 | **高**：若 BuyerRecon 后续自建 review UI，这是最值得借的开源模式 | citeturn29view4turn29view5turn29view6turn26view9 | 中高 |
| urlLangSmithturn22search2 / urlHumanloopturn22search11 / urlPhoenixturn22search1 | annotation queues、rubrics、manual human feedback runs、feedback schemas | pairwise queues、manual batch eval、categorical/continuous/freeform rubrics | 强 | programmatic feedback configs + run-level review progress | 高：能沉淀 reason-code quality memory | **高**：最适合 reason-code accuracy review 与 human-in-the-loop 规范化 | citeturn31view3turn31view4turn31view5turn31view6turn29view7 | 中高 |
| urldbtturn30view4 / urlGreat Expectationsturn30view5 / urlSodaturn5search13 | tests-as-code、failing rows、exposures、validation docs、human-readable checks | data tests + unit tests + validation docs | 无队列 | alerts/docs/lineage | **很高**：让“学习系统本身的数据基础”变成可验证资产 | **很高**：直接映射到 build contract、test plan、runtime proof | citeturn30view3turn27view7turn27view6turn30view6turn26view5turn26view4 | 高 |
| urlHubSpotturn7search0 / urlSalesforce Pipeline Inspectionturn7search14 | cross-object reporting、survey response properties、pipeline health/changes/insights | CRM 里的 reporting/inspection，而非模型实验 | 弱 | feedback properties → reports/segments/workflows；pipeline changes → leader view | **高**：如果反馈能映射到 case/outcome，就是 moat 增量 | **高**：适合 sales feedback → product signal loop 与 founder dashboard | citeturn27view4turn27view5turn7search14turn7search2 | 中高 |

## BuyerRecon Internal Learning Dashboard v0.1

这一版不建议做成“一个大而全 dashboard”。更好的结构是：**一个官方学习面板 + 一个变更控制台 + 两个审核队列 + 一个 case 学习库 + 一个版本比较页**。其信息架构要服务于四个问题：**我们最近学到了什么、为什么学到、哪一版更好、错了能不能立刻退。** 这与 Metabase 的 official/verified 模式、MLflow/W&B 的 version/lineage 模式、Persona/Stripe 的 case/review 模式、以及 Arize/WhyLabs/Evidently 的 compare-and-trace 模式高度一致。citeturn27view9turn23view0turn23view7turn31view1turn27view2turn23view3turn29view9turn27view11turn26view0

### 仪表盘分区

| 区块 | 目标 | v0.1 必含内容 | 默认受众 | 市场依据 |
|---|---|---|---|---|
| Founder Pulse | 让 Helen 只看“是否更准、更快、更可退” | 本周质量趋势、FP/FN 趋势、队列 aging、top 5 risky slices、候选版本是否可发、最新 5 条官方 insight、open decisions | Helen / founder | 风控 review + pipeline inspection + usage analytics 的领导视图模式。citeturn23view4turn7search14turn29view1 |
| Knob Control | 统一查看与申请 knobs 变更 | 当前 active knob set、最近 diff、变更 owner、预计队列影响、shadow/holdout 状态、rollback alias | Product / data / founder | PostHog remote config、Statsig overrides、MLflow aliases。citeturn28view4turn26view7turn23view7 |
| Experiment Lab | 看变更是否真的更好 | hypothesis、affected slice、baseline vs challenger、queue-load delta、calibration delta、launch checklist | Product / eng / analyst | PostHog hypothesis + small-change discipline；Statsig/LaunchDarkly holdouts。citeturn24view8turn24view7turn25view1 |
| Review Ops | 处理 FP/FN、novelty 与 escalation | 两个主队列、SLA、assignee、reason rubric、evidence drawer、resolution tags | Ops / analyst / PM | Stripe review queue、Persona SLAs/checklists。citeturn23view3turn24view3turn23view4 |
| Model Health | 解释为什么某版变差/变好 | feature coverage、drift、global importance、slice impact、delayed-actual updates、compare A/B | Product / eng / data | Arize tracing、WhyLabs explainability、Evidently compare。citeturn29view9turn27view11turn26view0turn26view1 |
| Customer Outcomes | 把结果回写成学习 | confirmed outcome、lag days、source confidence、notes、attached CRM/customer feedback | Sales / CS / PM | HubSpot survey properties + delayed actuals 模式。citeturn27view4turn24view2 |
| Sales Signal Loop | 把 GTM 反馈转成 product signal | fixed tags、deal stage impact、false-alarm themes、missed-buyer themes、segment report | Sales lead / PM | HubSpot custom reports、feedback properties、pipeline inspection。citeturn27view5turn24view11turn7search14 |
| Insight Library | 把 case-level learning 升级为官方知识 | official insight cards、verified status、owning team、before/after metrics、linked change records | 全团队只读 | Metabase official/verified、GX Data Docs、W&B reports。citeturn27view9turn27view8turn30view6turn31view1 |
| Improvement Log | 作为 evidence-grade 审计账本 | change id、score version、knob version、benchmark corpus、decision、rollback pointer、owner、timestamp | Product / eng / founder | MLflow registry + serialized assets + reports。citeturn23view7turn23view1turn31view2 |

### Knob 目录

| Knob | 作用 | 谁能改 | 变更前需要的证据 | 回滚方式 | 市场依据 |
|---|---|---|---|---|---|
| Review band thresholds | 定义 auto-pass / human-review / auto-reject（或 ignore） | Founder 审批；PM/analyst 提案 | baseline precision-recall、queue volume 预估、受影响 slice | 切回上一个 knob alias | 风控阈值/score 模式最成熟。citeturn27view1turn23view3 |
| Source trust weights | 给不同来源类型不同可信度 | PM + data owner | 过去误报率/漏报率分来源对比 | 恢复上一版权重集 | risk insights、feature importance 与 custom metrics 的组合启发。citeturn27view0turn24view1turn29view10 |
| Freshness decay window | 旧信号是否衰减、衰减多快 | PM + analyst | 按 lag 分桶后的 outcome 对比 | alias rollback | remote config + delayed actuals。citeturn28view4turn24view2 |
| Minimum evidence count | 没有达到最小证据数时必须进 review | PM + founder | case replay 中“少证据但高误判”分析 | alias rollback | 小数据阶段优先保守路由。citeturn23view3turn30view2 |
| Missing-data penalty | 缺失核心字段时如何降权 | PM + eng | failing rows / null coverage / missed outcome 分析 | alias rollback | dbt/GX/Soda + model health 模式。citeturn30view3turn30view6turn26view4turn29view11 |
| Reason-code confidence gate | reason code 置信度不足是否只显示“待审” | PM + analyst | rubric disagreement、pairwise review 结果 | alias rollback | Phoenix/LangSmith rubrics。citeturn31view3turn31view5turn31view6 |
| High-value escalation threshold | 高价值账户一旦命中哪些模式就强制人工看 | Founder + sales lead | revenue-weighted FP/FN 分析 | fallback route switch | pipeline + fraud escalation 的混合模式。citeturn23view3turn7search14 |
| Novelty routing threshold | 新型 case / 新来源 / 新切片何时进人工探索 | PM + analyst | drift / unseen pattern 告警 | alias rollback | WhyLabs/Evidently drift。citeturn26view1turn27view11 |
| Shadow ratio / holdout ratio | 新版只看不发 / 部分 holdout 做总效应衡量 | Founder + eng | frozen replay + shadow compare + launch checklist | stop shadow / switch alias | Statsig / LaunchDarkly holdouts。citeturn25view1turn24view7turn26view7 |
| Model/version alias | 哪个 scorer 是 live、哪个是 challenger | Founder + eng | registry compare + rollback pointer | alias revert | MLflow registry / compare runs。citeturn23view7turn31view0 |

### Knob 变更权限与证据门槛

| 变更等级 | 示例 | 谁能执行 | 最低证据门槛 | 发布方式 | 回滚 |
|---|---|---|---|---|---|
| Sandbox | 新增草稿权重、修改显示字段、试验新 note taxonomy | PM / analyst | 无需生产样本；只需 hypothesis | sandbox 环境 | 删除草稿 |
| Shadow | 新阈值、新 reason mapping、新 challenger scorer | PM 提案 + founder 同意 + eng 发布 | 固定 replay corpus 对比；必须给出 slice delta；建议至少有一组已裁决样本且受影响 slice 可读；这是基于实验假设与校准图样本需求的保守推断，不是单一厂商默认数字。citeturn24view8turn30view2 | shadow only / no customer-visible impact | alias 停用 |
| Production | 调整默认 review band、替换 live scorer、改 escalation policy | Founder 最终批准 | replay、shadow、queue impact、rollback drill、launch checklist 全部通过 | alias 切换 + holdout 监控 | 一键切回上个 alias |

### 客户案例字段

| 字段组 | v0.1 需要的字段 | 为什么必须结构化 | 市场依据 |
|---|---|---|---|
| 标识 | case_id、prediction_id、account_id、person_id、segment_id、created_at | delayed actuals、replay、CRM 绑定都靠稳定 ID | Arize delayed actuals；Persona case object。citeturn24view2turn27view2 |
| 评分上下文 | score_version_id、knob_version_id、review_route、confidence、reason_codes | 没有版本上下文就不能解释/回滚 | MLflow registry；risk insights。citeturn23view7turn27view0 |
| 证据 | evidence_bundle_id、source_types、freshness、top_features、raw_ref / hash、privacy_class | BuyerRecon 是 evidence-first，不是 event-count-first | WhyLabs profile 思路；dbt/GX 文档化思路。citeturn27view10turn30view6 |
| 人工裁决 | reviewer_id、checklist_state、disposition、override_reason、comment | 把“人判断了什么”变成可学习对象 | Persona modules；Phoenix rubrics。citeturn24view3turn31view5 |
| 真值结果 | outcome_status、outcome_source、outcome_confidence、lag_days、won/lost/qualified/not buyer | 这是后续校准与护城河核心 | HubSpot feedback properties；Arize actuals。citeturn27view4turn24view2 |
| GTM 反馈 | sales_tag、cs_tag、deal_stage_change、freeform_note | 让 sales/CS 反馈能统计、能回放 | HubSpot custom reports / properties。citeturn27view5turn24view11 |

### False-positive 与 false-negative 队列

| 队列 | 入队条件 | 默认优先级 | 关键列 | 关闭条件 | 市场依据 |
|---|---|---|---|---|---|
| False-positive queue | BuyerRecon 预测为“值得推进/值得高分/值得升级”，但最终结果显示不是 buyer motion 或被人工判定为低价值 | 高分误报、高价值账户误报优先 | predicted score、final disposition、reason-code diff、source mix、owner、SLA | 标明根因、是否要改 knob / reason / feature、是否加入 benchmark corpus | Stripe review queue + risk insights + Persona SLA。citeturn23view3turn27view0turn23view4 |
| False-negative queue | BuyerRecon 低分/未升级/未复审，但后续出现强 buyer outcome | revenue-weighted miss 优先 | missed signal、lag、downstream outcome、segment、top missing evidence | 根因标注完成、已进入 replay corpus、是否新建 feature request | delayed actuals + cohort comparison。citeturn24view2turn24view10turn28view2 |

### 评分版本比较视图

v0.1 的版本比较页建议固定展示这八个面板：**同一 replay corpus 的 confusion delta、reliability diagram、precision/recall at key bands、queue-load delta、reason-code agreement、slice winners/losers、feature coverage/drift delta、customer outcome delta**。这和 MLflow compare runs、Arize Compare A/B、WhyLabs feature importance comparison、Evidently reference/current 栈是同一路径。citeturn31view0turn29view11turn27view11turn26view0turn26view1turn30view2

### 特征表现视图

v1 不要只看“重要性”，而要看**覆盖率、缺失率、波动、drift、符号方向是否稳定、对主要错误类型的贡献**。若采用模型，可补充 entity["scientific_concept","SHAP","Shapley Additive Explanations"] 排名；若仍是 scorecard，也应保留 per-signal sign stability 和 slice lift。Arize 与 WhyLabs 都把全局特征重要性、版本间重要性变化、切片层差异视作高价值诊断信息。citeturn29view10turn27view11

### 客户结果、Sales 反馈、Insight Library 与 Improvement Log

BuyerRecon v0.1 应把**customer outcome feedback**做成单独对象，把**sales feedback**做成固定 taxonomy，把**insight library**做成官方验证空间，把**model improvement log**做成 append-only 审计账本。具体来说：

- **Customer outcome feedback**：至少包括 outcome status、confidence、lag、source、note、bound case IDs。依据是 HubSpot 的 survey response properties 可直接进入 segment/workflow/report，而 delayed actuals 系统要求可回绑到 prediction/case。citeturn27view4turn24view2
- **Sales feedback capture**：固定标签建议从 `real buyer`、`student/researcher`、`agency/vendor`、`competitor`、`wrong persona`、`too early`、`duplicate`、`channel partner` 开始，再保留自由备注。结构化先于完整。citeturn27view5turn24view11
- **Insight library**：每条 insight 必须带 status（draft/official/superseded）、related cases、before/after metrics、owner、verification date。Metabase 的 official/verified 与 GX Data Docs 都支持这种“把结论升格为官方资产”的模式。citeturn27view9turn27view8turn30view6
- **Model improvement log**：至少记录 hypothesis、change diff、benchmark corpus、result summary、decision、owner、deployed alias、rollback pointer。MLflow registry/W&B reports 给出了最接近的公开模式。citeturn23view7turn31view1turn31view2

**Fact**：公开最佳实践并不支持“一套 dashboard 给所有人看同样内容”；而是支持按角色切空间、切权限、切验证状态。citeturn25view8turn23view2turn25view9turn27view9

**Inference**：BuyerRecon v1 应把 founder、product/engineering、sales/CS 的信息架构分开；其中 product 可见 knobs 与版本差异，sales/CS 只应可见 case disposition 与 outcome，不应可见核心权重与全部敏感证据。citeturn25view8turn27view10

**Recommendation**：Sprint 5 不要自己重造复杂 BI；建议**轻量自建 case/review/knob UI + 官方 BI 层**并行，先把“学习闭环对象”做对。citeturn27view2turn23view3turn23view1turn29view1

**Open decision for Helen**：review queue 是不是要从第一天就完全内建。我的默认建议是：**内建最薄 case/review UI，BI 可先借官方/验证空间模式，不先自造全套图表系统**。citeturn27view2turn24view3turn27view9turn29view1

## 落地合同与治理

BuyerRecon 这轮研究最该落地的不是 UI 文案，而是五类“工程契约”：**build contract、test plan、runtime proof、Codex review checklist、rollback path**。公开工具里，最稳的部分都是围绕这些契约做的。citeturn23view6turn23view7turn30view3turn23view1

### Build contract

| 合同对象 | 非做不可的字段 | 验收标准 | 借鉴依据 |
|---|---|---|---|
| signal_event | source_type、timestamp、extractor_version、privacy_class、raw_ref/hash | 没有 extractor_version 不可入库 | versioned artifacts / profile-first。citeturn23view6turn27view10 |
| evidence_bundle | bundle_id、constituent signals、freshness、provenance、top features | 没有 provenance 不可评分 | evidence-first + risk factor transparency。citeturn27view0 |
| score_run | score_version_id、knob_version_id、feature snapshot、reason codes、confidence、route | 任一线上分数都能回放 | MLflow lineage/registry。citeturn23view7turn23view6 |
| review_task | queue_type、assignee、rubric_version、status、comments、attachments | 任一 override 都有 reviewer 与 rubrics | Persona/Phoenix/LangSmith。citeturn24view3turn31view5turn31view3 |
| outcome_event | case_id/prediction_id、outcome_status、source、lag_days、confidence | 任一关闭 case 最终都有 outcome placeholder | delayed actuals + survey properties。citeturn24view2turn27view4 |
| improvement_record | hypothesis、change diff、benchmark corpus、result、decision、rollback pointer | 任一生产变更都能追溯到 record | MLflow + W&B reports。citeturn23view7turn31view1 |

### Test plan

| 测试层 | 测什么 | 通过标准 | 借鉴依据 |
|---|---|---|---|
| Data contract tests | 必填列、主键、时间戳、null/unique/relationships | failing rows = 0 或在明确阈值内 | dbt/GX/Soda。citeturn30view3turn30view6turn26view4 |
| Unit tests | feature extraction、score math、reason-code mapping | 规则计算与 fixture 一致 | dbt unit tests / test-driven style。citeturn26view6turn27view7 |
| Replay benchmark | 固定语料上 old vs new 版本 | 输出 diff、slice diff、queue diff 可解释 | MLflow compare / Evidently compare。citeturn31view0turn26view0turn26view1 |
| Calibration tests | reliability diagram、Brier-style 质量、band precision | 关键 band 不劣化；若劣化则只能进 shadow | scikit-learn calibration。citeturn30view0turn30view1turn30view2 |
| Review workflow tests | checklist、comments、assignment、SLA、override proof | 任意 case 都能跟踪 reviewer 行为 | Persona / Stripe。citeturn24view3turn23view3turn23view4 |
| Shadow tests | challenger 上线但不改变用户结果 | queue 与 score 差异被记录且可查 | PostHog / Statsig。citeturn24view9turn26view7 |
| Permission tests | founder / PM / sales / CS 权限边界 | 非授权角色不能看敏感权重或原始证据 | Looker / Metabase。citeturn25view8turn25view9 |
| Rollback drill | alias 切回、队列恢复、报表恢复 | 在演练环境可完整回退 | MLflow alias + Metabase serialization。citeturn23view7turn23view1 |

### Runtime proof

BuyerRecon 每次分数与人工裁决都应有一个“proof drawer”，最少展示以下字段：**score_version、knob_version、evidence_bundle、top reasons、feature snapshot、confidence、review route、review actions、final outcome、与上一个版本的 diff**。这不是豪华配置，而是让系统配得上“evidence-first”定位的最低证明链。Stripe 会展示 top risk factors，MLflow 会保留 lineage/artifacts，GX 会把 validation results 文档化；BuyerRecon 需要对自己的判断也做到同等程度。citeturn27view0turn23view7turn30view6

### Codex review checklist

- 生产评分逻辑是否**没有硬编码阈值**，而是引用 `knob_version_id`。citeturn28view4turn23view7  
- 任一评分结果是否都能**回放到同一 evidence bundle**。citeturn23view6turn27view0  
- reason codes 是否来自**可审核的规则/特征快照**，而不是黑箱字符串。citeturn31view5turn29view10  
- 旧版本与新版本是否都能在固定语料上做 side-by-side compare。citeturn31view0turn26view0  
- 对数据输入是否有**contract tests** 与 failing-row 产物。citeturn30view3turn30view6  
- 是否把 FP/FN、novelty、escalation 当作不同 route，而不是一个“待处理”队列。citeturn23view3turn24view3  
- 是否有 delayed actual 回写机制。citeturn24view2turn24view0  
- 是否区分官方指标与草稿指标，且 query 变化会触发 re-verification。citeturn23view0turn27view9  
- 是否限制 sales/CS 只能见 case feedback，不见敏感权重/原始证据。citeturn25view8turn27view10  
- 是否支持 alias rollback，而不是手工改库。citeturn23view7turn23view1  
- 是否默认最小化原始数据保留。citeturn27view10turn26view4  
- 是否将 improvement records 作为 append-only 审计对象保留。citeturn23view7turn31view1

### Rollback path

1. **冻结当前变更窗口**：停止继续改 knobs / scorer alias。citeturn23view7turn24view9  
2. **切回上一个 live alias**：不是修补当前版本，而是 pointer revert。citeturn23view7  
3. **把影响期间的 case 全量落进 replay corpus**：为事后复盘留下样本。citeturn31view0turn26view3  
4. **重新计算 queue impact 与 slice diff**：确认故障影响面。citeturn29view9turn26view1  
5. **恢复官方 dashboard 口径**：如涉及报表资产，也要恢复到前一版 serialization/verified state。citeturn23view1turn23view0  
6. **把 incident 记入 improvement log**：包括 hypothesis、误差、回滚时间、后续 guardrail。citeturn23view7turn31view1  
7. **把新版本降级为 shadow challenger**：不立刻删除，继续只观测不影响生产。citeturn26view7turn24view9  

**Fact**：最成熟系统都把测试、可视化、版本与回滚纳入同一治理链路，而不是分散到零散脚本里。citeturn23view6turn23view7turn30view3turn23view1

**Inference**：BuyerRecon 若想建立“evidence-first”心智，真正要证明的不是“能打分”，而是“任何一次打分都能解释、重放、比较与撤销”。citeturn27view0turn23view7turn31view0

**Recommendation**：Sprint 5 的工程目标应优先完成这五份契约，再开发更多可视化细节。citeturn23view6turn30view3turn23view1

**Open decision for Helen**：需要明确“什么变更必须 founder 批准，什么变更允许 PM/data owner 走 shadow 自动流转”；这决定了 BuyerRecon 的演进速度与误发风险。citeturn24view8turn23view7

## 学习路径

开源练手路径建议先从 entity["software","Evidently","open-source ML/LLM evaluation and monitoring framework"]、entity["software","MLflow","open-source experiment tracking and model registry"]、entity["software","Label Studio","open-source AI evaluation and data labeling platform"]、entity["software","dbt","data transformation and testing tool"] 与 entity["software","Great Expectations","data validation framework"] 开始；它们分别覆盖“比较评估、版本治理、人工反馈、数据合同、验证文档”五个 BuyerRecon 最早期就需要的能力。citeturn26view3turn23view6turn29view5turn30view4turn30view5turn30view6

| 学习主题 | 先学什么 | 为什么现在学 | 推荐公开材料 |
|---|---|---|---|
| Model calibration | reliability diagram、band precision、概率校准 | BuyerRecon 的信心分若不校准，就无法设 review band | scikit-learn calibration module / CalibrationDisplay / Brier 示例。citeturn30view0turn30view1turn30view2 |
| Feature importance | 全局重要性、切片重要性、版本间变化 | 不知道哪些特征在推高误报，就无法做高质量 knobs | Arize explainability；WhyLabs explainability。citeturn29view10turn27view11 |
| Human-in-the-loop review | rubric 设计、队列状态、pairwise 评审 | reason-code 与 override 质量取决于 rubrics，不取决于 UI 漂亮程度 | Phoenix annotations；LangSmith queues；Label Studio review。citeturn31view5turn31view3turn26view9 |
| Experiment design | 假设、受影响用户、holdout、layer | BuyerRecon 的 knob 改动会互相干扰，必须会做隔离实验 | PostHog best practices；Statsig layers/holdouts。citeturn24view8turn25view0turn25view1 |
| FP/FN analysis | separate queues、severity weighting、queue aging | Sprint 5 的学习速度就来自错误组织能力 | Stripe Radar；Persona analytics。citeturn23view3turn23view4turn27view0 |
| Data quality monitoring | failing rows、expectations、checks、docs | 没有质量契约，后续所有 calibration 都会被脏数据误导 | dbt / GX / Soda。citeturn30view3turn30view6turn26view4 |
| entity["scientific_concept","Bayesian updating","statistical updating process"] 与 confidence scoring | 先学“如何把新证据更新旧判断”，再学完整贝叶斯实现 | BuyerRecon 的核心不是静态打分，而是证据逐步累积后的信心更新 | 先从概率校准与 delayed actuals 入手，再逐步把 prior/posterior 写进 offline notebooks。citeturn30view0turn24view2turn24view0 |
| Internal BI dashboard design | official vs draft、verification、permissioning、serialization | Sprint 5 不是 customer dashboard sprint，而是 governance sprint | Metabase official/verified/serialization；Looker permissions。citeturn27view9turn23view0turn23view1turn25view8 |
| Feedback-loop architecture | outcome object、survey/CRM property、workflow triggers | 不把反馈对象化，就无法沉淀 moat | HubSpot survey responses / custom report builder；Arize actuals。citeturn27view4turn27view5turn24view2 |
| Data moat strategy | outcome-confirmed memory、reason memory、最小化 raw data | BuyerRecon 需要的是“越用越准”，不是“越采越多” | WhyLabs profile-first；Stripe feedback loop；dbt exposures。citeturn27view10turn27view1turn27view6 |

## 最终基准与 Helen 待决

### 最终基准

| 模块 | 市场基准 | BuyerRecon v1 minimum | Evidence-grade improvement | Not-now / defer |
|---|---|---|---|---|
| Knob dashboard | remote config + safe overrides + holdout/alias 思路。citeturn28view4turn24view9turn25view1turn23view7 | 只做 8–10 个高杠杆 knobs、版本化、审批制 | 加入 queue impact 预测、固定 replay compare、one-click alias rollback | 不做几十个自由权重与 per-customer 手调 |
| Internal experiment dashboard | hypothesis、affected slice、small change、layers。citeturn24view8turn25view0 | 有 hypothesis、baseline/challenger、launch checklist | 再加 holdout、slice risk panel、queue delta | 不做复杂 sequential stats engine |
| Customer case learning loop | case object + checklist + comments + outcome feedback。citeturn27view2turn24view3turn27view4 | 每个客户案例都有 case_id、review、outcome | insight library + official verification + linked improvement record | 不做全自动工作流编排 |
| Signal calibration workflow | reliability diagram + delayed actuals + compare reference/current。citeturn30view2turn24view2turn26view1 | band precision、reliability plot、lag-aware backfill | slice-level calibration history + calibrated threshold review | 不做在线自动校准 |
| False-positive / false-negative review | review queue + risk factors + SLA analytics。citeturn23view3turn27view0turn23view4 | FP/FN 双队列、优先级、owner、root cause tags | severity weighting + recurring pattern dashboard | 不做无监督自动关单 |
| Model feature performance tracking | performance tracing + feature importance + drift。citeturn29view9turn29view10turn27view11 | coverage、missing、drift、importance、slice impact | version-over-version feature shift + protected slice watchlist | 不做因果归因平台 |
| Evidence-grade improvement log | registry + lineage + reports + docs。citeturn23view7turn31view1turn30view6 | append-only improvement record | official insight card + rollback pointer + benchmark corpus | 不做过度自动化 narrative generation |
| Customer outcome feedback loop | survey response properties + delayed actual binding。citeturn27view4turn24view2 | outcome object + confidence + lag + note | customer-confirmed vs CRM-confirmed 分层可信度 | 不做多系统双向全量同步 |
| Sales feedback → product signal loop | CRM properties + custom report builder + pipeline inspection。citeturn27view5turn7search14 | 固定 taxonomy + 周报 | 与 FP/FN queue 联表出 recurring themes | 不做复杂 Sales Ops 自动化 |
| Data moat strategy | fraud feedback loops + profile-first observability + lineage。citeturn27view1turn27view10turn27view6 | 收 outcome、rationale、version context；少收 raw | 计算 moat KPI：已裁决案例数、confirmed outcomes、fixed failure modes | 不做通用 clickstream warehouse |
| Human review queue | Cases + annotation queues + rubrics + reviewer dashboards。citeturn24view3turn31view3turn26view9 | queue、rubric、comments、attachments、SLA | pairwise compare、reviewer QA、disagreement tracking | 不做大型标注管理平台 |
| Model/algorithm version comparison | run/model compare + alias + compare A/B。citeturn31view0turn23view7turn29view11 | baseline/challenger compare page | replay corpus + slice regression alerts + queue impact | 不做自动 promotion |
| Benchmark vs competitor tools | official metrics/library/verified assets。citeturn27view9turn25view10 | 一个官方 benchmark 页，按模块打分 | 每月 competitor scorecard 直接链接 roadmap decision | 不做 UI parity chasing |
| Founder decision dashboard | pipeline-style leader view + usage analytics。citeturn7search14turn29view1 | 质量、队列、结果、版本风险、open decisions | 加 moat accumulation 与 release confidence | 不给 founder 分析台级别自由探索 |

**Fact**：BuyerRecon 所需的关键公开模式大多已经存在，只是分散在 product analytics、fraud ops、ML monitoring、HITL 与 BI 治理产品里。citeturn24view8turn23view3turn29view9turn31view3turn27view9

**Inference**：真正的机会不是复制任何一个单品，而是把这些模式组装成一个“buyer-motion verification operating system”。citeturn28view3turn27view2turn23view7turn24view2

**Recommendation**：BuyerRecon v1 的优先级应是：**versioned knobs → replay corpus → FP/FN queues → outcome backfill → official insight library**；不要先冲“高级模型”或“客户级 BI 皮肤”。citeturn23view7turn31view0turn23view3turn24view2turn27view9

**Open decision for Helen**

| 待决问题 | 为什么重要 | 默认建议 | 锁定前要补的证据 |
|---|---|---|---|
| v1 scorer 是“可解释 scorecard”还是“轻量模型” | 决定 knobs 设计、reason-code 透明度、回滚复杂度 | **先可解释 scorecard + calibrated thresholds；另跑 shadow challenger** | replay corpus 上的 calibration、FP/FN、queue impact。citeturn30view0turn29view11turn31view0 |
| review queue 要不要完全内建 | 决定 Sprint 5 工程量 | **内建最薄 case/review UI，BI 不全内建** | 看 case volume、review SLA 是否已经形成稳定模式。citeturn27view2turn24view3turn29view1 |
| primary ground-truth label 选什么 | 决定校准目标 | **优先“被确认的 buyer-motion outcome”，不要只看 meeting booked** | 统计 CRM/customer feedback 的可获得性与时滞。citeturn27view4turn27view5turn24view2 |
| 原始证据保留多少 | 关系到隐私与 moat 方向 | **默认保留衍生特征 + redacted refs/hash；谨慎保留 raw** | 评估哪类 raw data 真能提高判定，而非只是“看起来更全”。citeturn27view10turn26view4 |
| 哪些 knobs 需要 founder 审批 | 关系到速度与失误风险 | **live threshold、live scorer alias、escalation policy 要 founder 批；其余可 shadow 自主** | 根据未来 2–3 次变更的实际影响范围复盘。citeturn24view8turn23view7 |
| moat KPI 怎么定义 | 决定团队是否在正确积累资产 | **看 adjudicated cases、confirmed outcomes、reason-code coverage、fixed failure modes** | 建一版月度 moat scorecard，跑 4 周观察是否稳定。citeturn27view1turn27view6turn27view9 |