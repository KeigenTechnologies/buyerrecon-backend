# BuyerRecon Sprint 4 治理层深研报告

基于截至 2026-05-08 可公开访问的官方文档、帮助中心、公开 API 文档和公开产品说明，BuyerRecon 要做到“轻量但可信”的 v1，最小治理集不应追求企业合规模板大全，而应先把五件事做实：**分层数据保留、可执行的数据删除、不可变管理审计、能行动的监控告警、固定且可证明的租户访问边界**。市场样本里，urlPostHog 文档turn0search0、urlMatomo 文档turn0search1、urlMicrosoft Clarity 文档turn1search5、urlSnowplow 文档turn16search9、urlTwilio Segment 文档turn24search13、urlRudderStack 文档turn23search15、urlSentry 文档turn11search8、entity["software","Prometheus","monitoring system"]、entity["software","Grafana","observability platform"]、entity["software","OpenTelemetry","observability framework"]、urlSupabase 文档turn8search6、entity["software","Keycloak","identity and access management software"]、urlAuth0 文档turn22search20、entity["software","OpenFGA","fine-grained authorization software"]，以及 entity["organization","OWASP","application security nonprofit"] 和 GDPR/PECR 监管指引，基本都在强调这些点，只是成熟度和定价层级不同。citeturn26view0turn26view1turn26view2turn26view3turn26view6turn26view7turn26view10turn27view2turn29view0turn29view4turn31view0turn31view1turn31view9turn34view0turn4search1turn4search2turn4search19turn8search1turn8search2turn20search0turn22search2turn19search1turn9search0turn10search4turn10search12

对 BuyerRecon 而言，**“可信”** 不等于一开始就做 SCIM、客户自定义保留规则、全量细粒度授权图谱、SOC 2 级流程体系；它更像是：**默认少采、默认短留、默认可删、默认留痕、默认按租户隔离、默认管理员更严**。这与 GDPR 的数据最小化、存储限制和问责原则一致，也与监控/告警领域“只对可行动问题报警”的主流做法一致。citeturn10search3turn10search4turn10search12turn9search5turn4search1turn11search13

## 执行摘要

### Top 10 governance lessons

1. **事实**：成熟产品越来越把“数据契约/跟踪计划”放在治理前面，而不是放在事后修数；Snowplow 的 tracking plan 明确 owner、change history、contract，Segment 的 Tracking Plan 也把事件规范作为组织协作资产。**建议**：BuyerRecon 先做 build contract，再写后端。citeturn29view0turn29view1turn31view4  
2. **事实**：监管与市场样本都强调最小化采集，而不是“先采全量、以后再清洗”；EDPB、ICO 与 CNIL 都把必要性、比例性、告知/同意或反对机制放在前面。**建议**：BuyerRecon 默认不存原始请求体、不存完整 IP、不做回放型采集。citeturn10search4turn10search12turn9search5turn10search2  
3. **事实**：主流产品几乎都把不同数据类型拆成不同保留窗口，而不是一个“全局保留天数”。**建议**：至少拆成原始证据、派生证明、审计日志、运维日志四类。citeturn26view6turn26view10turn31view0turn33search0  
4. **事实**：删除工作流不再只等于“删历史数据”，更多是“删 + 抑制未来再采集”。**建议**：BuyerRecon v1 应同时支持 deletion 与 suppression/tombstone。citeturn31view5turn31view11  
5. **事实**：审计日志的最低可用形态不是 SIEM 套件，而是“谁、何时、改了什么、作用到哪个资源”。**建议**：BuyerRecon 把 audit log 作为核心表，而不是后台附属功能。citeturn26view1turn31view1turn31view9turn8search2  
6. **事实**：租户边界普遍采用组织/工作区/项目/资源的层次模型。**建议**：BuyerRecon 明确 workspace / project / site 三层，不做隐式共享。citeturn26view3turn32view0turn31view2turn22search12turn20search0  
7. **事实**：v1 最安全的授权模型通常是固定角色 + 资源绑定，而不是一开始就做动态自定义角色。**建议**：先做 4 个固定角色，延后自定义角色。citeturn27view2turn13search0turn22search2turn8search1  
8. **事实**：可靠性治理现在不只看 infra 健康，还看 URL 可用性、定时作业心跳和数据质量。**建议**：BuyerRecon 要同时监控 collector、cron/job、failed writes、failed events。citeturn34view0turn35search0turn35search5turn29view4turn29view5  
9. **事实**：观测数据正在向标准语义收拢，OpenTelemetry 强调统一语义和低基数 error 属性。**建议**：BuyerRecon 从第一天就按 OTel 命名，而不是以后重构。citeturn4search19turn11search11turn11search23  
10. **推断**：对 BuyerRecon 这种 evidence-first 产品，客户真正关心的是“决策为什么得出”和“删了没有”，而不是一个大而全治理后台。**建议**：把 runtime proof 与 deletion receipt 做成产品级能力。citeturn29view1turn31view5turn31view11  

**Helen 待决策**：BuyerRecon 的“证据级证明”要保留 90 天还是 180 天；是否允许客户导出证明摘要；是否接受未来企业版再做自定义保留策略。  

### Top 10 retention/audit lessons

1. **事实**：Matomo 明确区分 raw logs 与 aggregated reports，Clarity 也区分 recordings、favorited/labeled sessions 与 heatmaps。**建议**：BuyerRecon 不要把所有表统一 TTL。citeturn26view6turn26view10  
2. **事实**：Segment 公布了按 tier 和数据类型区分的 retention，RudderStack 公开提供“不存 / 客户自存 / 7 天 / 30 天”几档。**建议**：BuyerRecon v1 先提供一个固定默认策略，不做复杂套餐矩阵。citeturn31view0turn33search0  
3. **事实**：Matomo 的 Activity Log 默认“永久保存”，这是可审计但也容易过保留。**建议**：BuyerRecon 审计日志应明确 365 天而不是默认永久。citeturn26view7  
4. **事实**：PostHog、Matomo、Segment、RudderStack 都公开了删除或抑制用户数据的路径。**建议**：BuyerRecon 删除工作流必须是正式 API / 后台动作，而不是人工 SQL。citeturn26view5turn26view9turn31view5turn31view11  
5. **事实**：PostHog 明确提醒删除 person 后若复用 distinct_id 需要 reset deleted person；Segment/RudderStack 都强调 suppress future collection。**建议**：BuyerRecon 删除后必须保留 suppression tombstone。citeturn26view5turn31view5turn31view11  
6. **事实**：审计日志常覆盖角色变更、用户管理、配置变更、来源/目标变更、MFA 等。**建议**：BuyerRecon 审计事件至少覆盖 role、member、site、token、retention、deletion、break-glass。citeturn1search8turn31view1turn31view9turn8search2  
7. **事实**：查看审计日志本身也经常受权限控制；Segment 需要 Workspace Owner，PostHog 可通过 access control 限制。**建议**：BuyerRecon 审计日志只给 owner/admin，viewer 不可见。citeturn12search3turn3search1  
8. **事实**：Clarity 明说超过保留期后的数据和备份不可恢复。**推断**：BuyerRecon 的 retention job 应默认先 dry-run，再 hard delete。citeturn26view10  
9. **事实**：ICO 当前公开指引仍要求 analytics cookies 取得同意；CNIL 仅在严格条件下允许 audience measurement 豁免并要求告知与可反对。**建议**：BuyerRecon v1 设计应优先无 cookie / 低标识模式。citeturn9search2turn9search5turn10search2  
10. **事实**：Snowplow 可在入库前做 IP anonymization 与 PII pseudonymization，Clarity 默认 masking。**建议**：BuyerRecon 应把“入库前最小化”写进 policy，而不是只靠删数。citeturn30view2turn29view2turn26view11  

**Helen 待决策**：BuyerRecon 是否默认完全不保留原始请求体；证据表是否允许客户级延长；删除完成后的保留回执是否保留 365 天。  

### Top 10 monitoring lessons

1. **事实**：Prometheus 的实践文档明确建议“instrument everything”，每个库、子系统、服务都至少应该有少量关键指标。**建议**：BuyerRecon 每个关键流程都要有最少指标面。citeturn4search5  
2. **事实**：Prometheus 建议告警尽量简单、告警症状而不是原因、避免“报警后无动作”。**建议**：BuyerRecon 分 page/ticket 两级，不做一堆噪音阈值。citeturn4search1  
3. **事实**：Sentry 把 alert 类型显式分成 issue、metric、uptime；cron monitor 针对 missed / maximum runtime / failure。**建议**：BuyerRecon 也要把“错误、阈值、URL 存活、定时作业”分模型管理。citeturn34view0turn35search0turn35search7  
4. **事实**：Snowplow 把 failed events 看成数据质量监控的一级对象，并提供 dashboard 与每 10 分钟的警报检查。**建议**：BuyerRecon 要监控 failed ingest / invalid evidence / dropped scoring，而不仅是 CPU 和 500。citeturn29view4turn29view5turn29view6  
5. **事实**：Grafana SLO 文档强调 fast-burn 与 slow-burn 两类 error budget 告警。**建议**：BuyerRecon v1 先有一个小 SLO 集合，而不是没有 error budget。citeturn4search2turn4search6  
6. **事实**：Grafana IRM 把 incident timeline 定义为单一真实时间线。**建议**：BuyerRecon 事故处理必须有 timeline 模板，而不是散落在 Slack。citeturn11search1turn11search13  
7. **事实**：OpenTelemetry 语义约定的价值在于统一命名，使指标/日志/trace 可复用。**建议**：BuyerRecon 的 metric/log/span 字段应有统一命名规范。citeturn4search19turn4search7  
8. **事实**：OpenTelemetry 建议出错时设置 span status=Error、设置 error.type，而不建议把高基数 error.message 放进 metrics/spans。**建议**：BuyerRecon 的错误指标只保留低基数字段。citeturn11search11turn11search23  
9. **事实**：Sentry 的 uptime 默认可按连续失败次数触发；官方说明提到默认是 3 次连续失败。**建议**：BuyerRecon 的 collector/readiness 监控可沿用“3 次连续失败再判定 down”的思路。citeturn35search5turn34view0  
10. **推断**：对 v1 来说，最有价值的不是复杂 AIOps，而是“公共入口、写库、打分、报表、删除、保留 job”六条链路的可观测性。**建议**：这些链路必须都有 heartbeat、error rate、latency、backlog。citeturn4search5turn35search0turn29view5turn11search13  

**Helen 待决策**：BuyerRecon 的首版 SLO 是 99.5% 还是 99.9%；首版是否引入 burn-rate 告警，还是只做阈值告警。  

### Top 10 auth/access lessons

1. **事实**：Auth0 Organizations、Keycloak realms、PostHog organizations、RudderStack workspaces 都把“组织上下文”作为第一层隔离。**建议**：BuyerRecon 先把租户上下文建模清楚，再谈功能。citeturn22search12turn20search0turn26view3turn32view0  
2. **事实**：Clarity 只有 Admin / Team member 两类角色，Matomo 只有 View / Write / Admin / Superuser 四类。**推断**：早期产品用固定角色更稳。**建议**：BuyerRecon v1 先固定 4 角。citeturn27view2turn13search0turn26view8  
3. **事实**：Auth0 公开文档直接把 dashboard least privilege 作为设计目标。**建议**：BuyerRecon 的后台角色从最小权限开始，而不是“everyone admin until later”。citeturn22search2  
4. **事实**：Segment、PostHog、RudderStack 都支持把权限作用到 workspace/project/resource 层。**建议**：BuyerRecon 至少做到 workspace 级角色 + project/site 级资源绑定。citeturn31view2turn26view2turn31view13  
5. **事实**：Segment SCIM/JIT 用户默认是 Minimal Workspace Access；Snowplow SSO 新用户默认 view-only。**建议**：BuyerRecon SSO 若上线，默认应是最小访问。citeturn31view3turn31view7turn29view8  
6. **事实**：Supabase 把 JWT、RLS、custom claims、on delete cascade 结合成应用授权的公共模式。**建议**：如果 BuyerRecon 走 Postgres 路线，可直接采用“JWT + service claims + SQL tenant filters/RLS-like checks”。citeturn6search1turn6search5turn6search0turn7search1  
7. **事实**：Keycloak 公开说明 realms 管理 users/apps/roles/groups，events 是可查看和挂接的审计流。**建议**：BuyerRecon 即使不用 Keycloak，也应复制“realm-like tenant + auditable admin actions”模式。citeturn20search0turn21search7turn21search10  
8. **事实**：OpenFGA 的核心强项是关系型授权、组织上下文和动态角色。**推断**：BuyerRecon 还不到必须引入 FGA 引擎的阶段。**建议**：把 OpenFGA 作为 not-now。citeturn19search10turn19search1turn19search14turn19search11  
9. **事实**：管理员 MFA 已是公开文档中的常见基线，Supabase、Auth0、RudderStack 审计里都能看到相关入口或事件面向。**建议**：BuyerRecon 至少要求内部管理员和客户 owner 开启 TOTP。citeturn7search0turn22search24turn31view9  
10. **推断**：BuyerRecon 最关键的负面测试不是“登录成功失败”，而是跨 workspace 读写、跨 site 配置、角色提升、已删除用户继续进数、过期 token 继续写入。**建议**：把这些作为 auth/access 必测项。citeturn22search12turn31view3turn29view8turn19search14  

**Helen 待决策**：v1 是否开放 viewer；客户是否需要 project admin；SSO 与 SCIM 是否完全延后到企业客户驱动时再做。  

## 治理基准矩阵

| Product/standard | Retention approach | Audit log approach | Monitoring/incident pattern | Auth/access model | Workspace/site boundary | Privacy/security language | BuyerRecon applicability | Source | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| PostHog | 公开文档更强调采集前/采集后控制；person 可删；未在本次审阅到简洁统一的全局 retention 表。 | 活动日志强调“谁改了什么、何时”。 | 本身不是运维治理样本；更适合借鉴产品内 activity model。 | Enterprise 才有 project/resource 级 RBAC。 | organization → project。 | 将 data collection 与 data storage 分开治理。 | 高：适合借鉴项目隔离、活动日志、person 删除。 | citeturn26view0turn26view1turn26view2turn26view3turn26view5 | 高 |
| Matomo | raw logs 与 aggregated reports 分开；raw data 可按天删；审计日志默认永久。 | Activity Log 覆盖用户/配置活动，且默认永久保存。 | 非运维监控样本。 | 固定角色，官网公开为 View/Write/Admin/Superuser。 | website 级权限分配。 | 强调 IP 匿名化、GDPR tools、right to erasure。 | 高：适合借鉴保留分层、GDPR 工具入口、固定角色。 | citeturn26view6turn26view7turn26view8turn26view9 | 高 |
| Microsoft Clarity | recordings 30 天；favorited/labeled sessions 13 个月；heatmaps 13 个月。 | 没有像 Segment/RudderStack 那样面向治理的广泛审计面；项目与成员操作更偏轻量。 | 更偏产品功能监控，不是运维治理主样本。 | 只有 Admin / Team member 两类角色。 | project（域名/网站）为边界；项目唯一 tracking code。 | 默认 masking；EEA/UK/CH 明示 consent；删除 project 不可恢复。 | 中高：适合借鉴轻量角色、短保留与默认脱敏。 | citeturn26view10turn26view11turn27view2turn26view13turn28view0turn28view1 | 高 |
| Snowplow | 更像“把最小化与治理前移到 pipeline”；IP/PII 在入库前处理；失败事件可单独表。 | tracking plan 自带 owner/change history/contracts；控制台权限与 API key 管理清晰。 | 把 failed events、data quality dashboard、10 分钟告警作为一级对象。 | Global Admin / User / Custom；权限细到 tracking plans、schemas、API keys。 | source application / tracking plan / environment 明确。 | 直接把 schema、ownership、contract、observability 绑在一起。 | 很高：最适合 BuyerRecon 的 build contract + runtime proof 思路。 | citeturn29view0turn29view1turn29view2turn30view2turn29view4turn29view5turn29view7turn29view8 | 高 |
| Segment | 按数据类型和 tier 明确 retention；Business 可到 3 年。 | Audit Trail 可看 90 天，支持过滤、导出、forwarding。 | 审计 forwarding 可接实时告警。 | 角色对资源生效；SSO/SCIM 新用户默认 Minimal Workspace Access。 | workspace → sources/spaces/resources。 | Privacy Portal 强调 inventory、alerts、deletion/suppression。 | 很高：适合借鉴删除+抑制、最小默认访问、审计 forwarding。 | citeturn31view0turn31view1turn31view2turn31view3turn31view5turn31view6turn31view7 | 高 |
| RudderStack | 明确“不存 / 客户自存 / 7 天 / 30 天”；sample events 30 天。 | Audit Logs + Audit Logs API；enterprise 才有。 | workspace/source 级 alerts；Event Audit API 与 data governance 关联。 | Admin / Member + 资源权限；workspace 间权限可不同。 | organization → workspace；dev/prod 明确隔离。 | 把 retention、audit、alerts、credentials、PII control 放进 workspace settings。 | 很高：最适合借鉴“轻量但像真的”工作区治理。 | citeturn33search0turn32view0turn31view9turn31view10turn31view12turn31view13turn32view3 | 高 |
| Sentry | 非数据保留样本主角。 | 非后台审计主角。 | issue / metric / uptime alerts；cron monitor 关注 missed / max runtime / failure。 | alerts 创建可设最小角色。 | project/team 维度。 | 强调可配置 threshold、避免 alert fatigue。 | 很高：适合 BuyerRecon 的 job heartbeat 与入口可用性。 | citeturn34view0turn35search0turn35search3turn35search5turn36view3 | 中高 |
| Prometheus | 不规定业务 retention，本质是 metrics 工具。 | — | instrument everything；alert on symptoms；简化告警。 | — | scrape target / exporter。 | 偏工程运维语言。 | 很高：适合作为 BuyerRecon metrics/alerting 思维基线。 | citeturn4search1turn4search5turn11search14 | 高 |
| Grafana | 不规定业务 retention。 | incident timeline / IRM 提供事故记录。 | SLO、fast-burn/slow-burn、IRM、timeline、post-incident。 | 多依赖上游身份系统。 | dashboard / service / incident。 | 把 reliability target 与 incident workflow 连起来。 | 很高：适合 BuyerRecon 的 error budget 与 incident template。 | citeturn4search2turn4search10turn11search1turn11search13 | 高 |
| OpenTelemetry | 不规定业务 retention。 | — | 规定 traces/metrics/logs 语义；标准化 error recording。 | — | service/resource/span。 | 强调 semantic conventions、low-cardinality errors。 | 很高：适合作为 BuyerRecon 运行证明与可观测命名标准。 | citeturn4search19turn11search11turn11search15turn11search23 | 高 |
| Supabase Auth | Auth 本身不是 retention 样本；用户表与业务表可 on delete cascade。 | 平台有 platform audit logs；Auth 也有 auth audit logs。 | 更偏平台运维，不是 IRM 主样本。 | org/project 粒度 access control；JWT + RLS；hooks；MFA；SSO。 | organization → project。 | 公开把 least privilege、RLS、JWT claims 说得很明确。 | 高：若 BuyerRecon 走 Postgres，可直接借鉴。 | citeturn8search1turn8search2turn6search1turn6search0turn6search2turn7search0turn8search0 | 高 |
| Keycloak | 可配置事件保留；公开文档把 events 定义为审计流。 | 管理员动作和用户事件都可审计；日志用于健康、调试和审计轨迹。 | 用户事件可暴露为 metrics。 | realm 管 users/apps/roles/groups；支持更细粒度 admin permissions。 | realm 为强边界。 | 强身份/行政权限治理语言。 | 中高：适合做 BuyerRecon admin governance 参考，不一定适合 v1 直接上。 | citeturn20search0turn20search2turn21search7turn21search10 | 中高 |
| Auth0 | 日志保留依订阅；可通过 API/streams 导出。 | tenant logs 覆盖认证与管理动作；dashboard access 按角色。 | log streams 可外送分析系统。 | Organizations + RBAC + Dashboard least privilege。 | tenant / organization。 | 强调组织上下文与 least privilege。 | 高：适合 BuyerRecon 的 B2B 租户化访问模型。 | citeturn22search1turn22search2turn22search3turn22search12turn22search13turn22search22 | 高 |
| OpenFGA | 非 retention 样本。 | 非审计样本。 | 非监控样本。 | relationship tuples、org context、custom roles、ReBAC/FGA。 | object / relation / organization context。 | 解决复杂资源图授权。 | 中：适合未来复杂站点共享/代理访问，不适合 v1 先上。 | citeturn19search10turn19search1turn19search14turn19search11 | 高 |
| OWASP Logging Guidance | 主张安全日志与可监控词汇表。 | 强调 logging/monitoring failure 是真实风险。 | 关注可检测、可响应，而不是只写日志。 | — | — | 偏安全控制基线。 | 很高：适合 BuyerRecon 的安全日志 schema 和 review checklist。 | citeturn9search0turn9search3turn9search9 | 高 |
| GDPR / ICO / CNIL guidance | 数据最小化、存储限制、告知/同意或反对机制是硬边界。 | 问责原则要求能证明合规。 | — | — | — | 对 analytics cookies 与最小化要求明确。 | 很高：决定 BuyerRecon 不能走“先采满再说”的路径。 | citeturn10search3turn10search4turn10search12turn9search2turn9search5turn10search2 | 高 |

## BuyerRecon v1 治理模型

### 结论先行

**事实**：市场中的“可信 v1”并不等于完备企业套件，而是把最小化、分层 retention、删除可执行、审计可追责、角色最小权限和基础监控做成默认。citeturn31view0turn31view5turn31view9turn34view0turn8search1turn22search2  
**推断**：BuyerRecon 作为 evidence-first buyer-motion verification layer，最该长期保留的不是“原始前端细节”，而是**决策证明**。  
**建议**：v1 治理模型应以“短保留原始证据、较长保留证明与审计、默认删除与抑制、最小角色集、强内部访问留痕”为中心。  
**Helen 待决策**：BuyerRecon 是否愿意在 v1 明确写成公开 policy，而不是只做内部约定。  

### retention policy

以下为 BuyerRecon v1 推荐值。它们是**建议基线**，不是对市场文档的机械照抄；依据来自 Clarity/Matomo/Segment/RudderStack 的分层 retention 与 GDPR 的最小化/存储限制原则。citeturn26view6turn26view10turn31view0turn33search0turn10search3turn10search12

| 数据类 | 推荐保留 | 是否客户可见 | 说明 |
|---|---:|---|---|
| 原始 collector 请求体 | **0 天** | 否 | 默认不落盘；只在内存处理并提取最小必要字段。 |
| 规范化证据事件 | **30 天** | 否 | 仅保留 pseudonymous identifiers、site/project/workspace、必要 headers 摘要、规则输入。 |
| 评分/判定证明记录 | **180 天** | 是（摘要） | 保存 decision、reason codes、rule/model version、evidence refs、request_id。 |
| 报表缓存/导出缓存 | **7 天** | 是 | 报表应可重算；缓存不应长期保存。 |
| 应用运行日志 | **30 天** | 否 | 严格去敏，不记录 secret、完整 token、完整 IP、完整原始 payload。 |
| 审计日志 / 管理员访问日志 | **365 天** | 否 | append-only；作为合规与事故追责基线。 |
| 删除请求与完成回执 | **365 天** | 仅回执摘要 | 证明删除流程被请求、审批、执行、完成。 |
| 备份 | **≤35 天** | 否 | 必须写进删除说明：主存删除后，备份按备份周期自然过期。 |

### audit log table

**事实**：PostHog、Segment、RudderStack、Supabase、Keycloak、Auth0 都把审计留痕作为实际能力，不只是“系统日志”。citeturn26view1turn31view1turn31view9turn8search2turn20search0turn22search5  
**建议**：BuyerRecon v1 建一个单独的 `audit_events` 表，而不是从应用日志反推。  

| 字段 | 必需 | 说明 |
|---|---|---|
| event_id | 是 | UUID。 |
| occurred_at | 是 | UTC 时间。 |
| actor_type | 是 | user / service / cron / support_break_glass。 |
| actor_id | 是 | 用户或服务主体。 |
| actor_role | 是 | 当时角色快照。 |
| workspace_id | 是 | 强制租户归属。 |
| project_id | 否 | 如果作用到项目。 |
| site_id | 否 | 如果作用到站点。 |
| action | 是 | 例如 `role.grant`、`site.update`、`deletion.execute`。 |
| target_type / target_id | 是 | 被影响资源。 |
| request_id | 否 | 方便串联 trace。 |
| source | 是 | ui / api / job / support_tool。 |
| outcome | 是 | success / denied / failed。 |
| before_hash / after_hash | 否 | 对配置类事件记录前后摘要，不存敏感值明文。 |
| reason_code | 否 | 删除、break-glass、policy change 的理由。 |
| ip_truncated / ua_hash | 否 | 管理员访问足够留痕但不过采。 |

**必须审计的事件集**：登录成功/失败、MFA 启用/移除、成员邀请/移除、角色授予/撤销、site 创建/更新/删除、API key 创建/轮换/撤销、retention policy 变更、deletion request 创建/审批/执行/失败、support break-glass 开启/关闭、报表导出、项目归档/恢复。  

### deletion workflow

**事实**：Segment 与 RudderStack 的公开删除能力都强调删除历史数据并抑制后续采集。Matomo 和 PostHog 也都提供删除路径。citeturn31view5turn31view11turn26view9turn26view5  

**建议工作流**：

1. **接收请求**：仅 workspace owner 或 BuyerRecon support 在验证身份后发起。  
2. **确定范围**：按 workspace / project / site / person-like identifier 四级之一执行。  
3. **dry-run**：返回将影响的表、记录数、缓存、对象存储路径，以及 suppression 是否已存在。  
4. **审批**：workspace owner 确认；内部 support 只执行，不单方面决定。  
5. **写入 suppression tombstone**：先阻止未来再进数。  
6. **执行删除**：热表、缓存、搜索索引、对象存储、派生缓存同步删除。  
7. **验证**：重跑 count / lookup，确认主路径不可见。  
8. **回执**：生成 deletion receipt，写入审计日志。  
9. **备份说明**：在回执中说明“备份副本将在备份窗口内自然过期，不用于正常访问路径”。  

**Helen 待决策**：删除是否允许到 `site` 级；是否允许客户自助删除 `workspace` 下全部数据；是否允许导出 dry-run 结果给客户。  

### dry-run retention job

**事实**：Clarity 说明保留后删除不可恢复；Sentry 把 cron/uptime 作为专门监视对象；Snowplow 对 failed events 采用单独监控。citeturn26view10turn35search0turn35search5turn29view5  

**建议**：BuyerRecon 每天跑一次 retention dry-run，另有单独 execute job。  
- `retention_dry_run`：产出“若今天执行，将删除多少记录/对象/缓存”的报告，不删除。  
- `retention_execute`：仅删除前一天 dry-run 已计算并仍符合条件的数据。  
- 两者都要有 job heartbeat、duration、candidate_count、deleted_count、failure_count。  
- dry-run 结果写进 `retention_runs` 表，并允许导出 CSV 给内部审计。  

### monitoring metrics

**事实**：Prometheus 强调每个服务至少有基本指标；OpenTelemetry 强调标准语义；Sentry/Grafana/Snowplow 则把 URL、crons、SLO 和 failed events 变成专门治理对象。citeturn4search5turn4search19turn34view0turn35search0turn29view4turn11search13  

| 监控面 | 最少指标 |
|---|---|
| collector | request_count、2xx/4xx/5xx、p95 latency、auth_fail_rate、queue_depth |
| DB writes | write_success_rate、write_error_rate、write_latency、retry_count |
| scoring | score_success_rate、score_error_rate、score_timeout_rate、score_p95 |
| reports | report_job_success_rate、report_job_fail_rate、report_job_backlog、report_latency |
| deletion | deletion_queue_depth、deletion_success_rate、deletion_age_max |
| retention jobs | dry_run_last_success、execute_last_success、candidate_count、deleted_count |
| audit subsystem | audit_write_failures、audit_lag_seconds |
| admin auth | login_failures、mfa_failures、break_glass_open_count |
| customer-facing availability | uptime of collector、uptime of reporting API |

### alert thresholds

以下阈值是 **BuyerRecon v1 建议值**。它们依据 Sentry 的 issue/metric/uptime/cron 思路、Prometheus 的“报警要可行动”原则、Grafana 的 SLO/burn-rate 思维提出。citeturn34view0turn35search0turn35search5turn4search1turn4search2turn11search13

| 信号 | Ticket | Page |
|---|---|---|
| collector uptime | 1 次检测失败后的观察告警 | **3 次连续失败**或连续 2 分钟不可用 |
| collector 5xx | 15 分钟 > 0.5% | 5 分钟 > 2% |
| DB write errors | 15 分钟 > 0.2% | 5 分钟 > 1% |
| scoring errors | 15 分钟 > 0.5% | 5 分钟 > 1% 或 backlog > 5 分钟 |
| report jobs | 连续 2 次失败 | 连续 5 次失败或 backlog > 30 分钟 |
| deletion job | SLA 超过 24 小时 | 连续 2 次调度未执行 |
| retention dry-run / execute | 单次失败 | 连续 2 次失败 |
| audit log writes | 任意失败写入记录 ticket | 连续 1 分钟写入失败 |
| admin login failures | 异常峰值 | 明显暴力尝试或 break-glass 未关闭超时 |

**error budget 建议**：  
- collector / ingest path：**99.5% / 30 天**。  
- scoring & report generation：**99.0% / 30 天**。  
- deletion workflow 完成 SLA：**7 个自然日**。  

### incident response template

**事实**：Grafana IRM 明确把 timeline、incident declaration、post-incident review 组成一套最小闭环。citeturn11search1turn11search5turn11search13  

**建议模板**：

- Incident ID  
- Severity：Sev1 / Sev2 / Sev3  
- Detected at / Declared at / Resolved at  
- Commander  
- Affected workspace/project/site  
- Customer impact  
- Current hypothesis  
- Mitigation taken  
- Rollback taken  
- Data exposure? yes/no  
- Retention/deletion/audit impact? yes/no  
- Customer comms owner  
- Next update time  
- Timeline entries  
- Follow-up actions  
- Postmortem due date  

**最低响应标准**：  
- Sev1：15 分钟内指派 commander，30 分钟更新一次状态。  
- Sev2：60 分钟内接手，当天给出补救计划。  
- Sev1/2：5 个工作日内 postmortem。  

### auth roles

**建议的最简安全角色集**：

| 角色 | 能力 | 不能做 |
|---|---|---|
| Workspace Owner | 成员管理、角色变更、retention policy、deletion approve、site/proj 全管理、导出删除回执 | 不能绕过审计；关键破坏操作需要二次确认 |
| Workspace Admin | 管理 project/site、查看审计、执行删除、看监控、处理 incident | 不能改 billing / owner / legal settings |
| Analyst | 读报告、读证明摘要、创建调查视图、导出非敏感汇总 | 不能改 site 配置、不能删数、不能看全量审计 |
| Viewer | 只读报告与证明摘要 | 不能导出敏感明细、不能改任何配置 |

**内部特殊角色**：  
- `support_break_glass`：默认无权限，必须工单 + 时限 + 审计事件 + 自动回收。  

**延后功能**：  
- 自定义角色。  
- SCIM / 组同步。  
- 跨组织共享资源。  
- ReBAC/FGA 引擎。  
- 客户自定义 label-based access。  

### workspace / project / site boundary

**建议模型**：

- **workspace**：客户公司/租户。保留策略、成员、审计、导出、删除 SLA 归属此层。  
- **project**：workspace 内的业务或环境边界，建议先按 `prod` / `staging` 或按业务单元切。  
- **site**：具体受追踪域名/collector origin/API key 绑定对象。必须显式 allowlist。  

**硬规则**：  
- 所有业务表必须带 `workspace_id`。  
- 所有 project 与 site 都必须属于唯一 workspace。  
- 所有查询默认先带 `workspace_id`，再带 `project_id/site_id`。  
- site key 只能写入其绑定 site。  
- 任何跨 workspace 导出在 v1 一律禁止。  

### negative tests

**事实**：市场样本都在用默认最小访问、角色边界和删除/审计能力降低误配风险。citeturn31view3turn29view8turn22search2turn27view2  

**必须测的负面用例**：

1. A workspace 的 viewer 不能读取 B workspace 的任何记录。  
2. project admin 不能给自己升成 owner。  
3. site key 不能写入其它 site。  
4. 被移除成员的旧 session/token 不能继续访问。  
5. 被删除 identifier 在 suppression 生效后不能重新进数。  
6. deletion dry-run 与 execute 结果不一致时必须阻断执行。  
7. audit log 写失败不能静默吞掉。  
8. retention execute 不能删除未达到保留窗的数据。  
9. admin break-glass 超时必须自动关闭。  
10. report export 不能导出未经授权 workspace 的数据。  

### external audit trigger

**建议**：BuyerRecon 不必一上来做重量合规，但应给 Helen 设一个**明确外部审查触发器**。满足任一条件即启动独立安全/架构审查：  
- 首个要求安全问卷或 DPA 附件的付费客户。  
- 生产环境内有 **3 个以上**付费 workspace。  
- 内部可接触生产数据的管理员超过 **3 人**。  
- 首次发生 Sev1 数据暴露、错误删除或审计缺口。  
- 产品需要引入 SSO/SCIM、自定义角色或跨 workspace 共享。  

## 学习路径

### 推荐学习顺序

1. **GDPR 数据原则**：先读数据最小化、存储限制、问责，再做 retention schema。citeturn10search3turn10search4turn10search12  
2. **OWASP Logging**：定义什么必须记、什么不能记、字段词汇如何统一。citeturn9search0turn9search3turn9search9  
3. **Snowplow Tracking Plans / Event Studio**：把 event contract、owner、change history、proof artifact 想清楚。citeturn29view0turn29view1  
4. **OpenTelemetry semantic conventions**：统一 metric/log/trace 字段名，避免 v2 重命名。citeturn4search19turn11search11turn11search23  
5. **Prometheus alerting/instrumentation**：决定最小指标盘和 page/ticket 分级。citeturn4search1turn4search5  
6. **Sentry monitors + Grafana IRM/SLO**：把 URL、cron、incident timeline、error budget 做成治理基本盘。citeturn34view0turn35search0turn35search5turn11search1turn11search13  
7. **Supabase Auth / Auth0 / Keycloak**：理解固定角色、least privilege、审计、SSO 的实际产品模式。citeturn8search1turn8search2turn22search2turn22search12turn20search0  
8. **OpenFGA**：仅在 BuyerRecon 未来出现复杂资源共享、代理访问、组织上下文授权时再进入。citeturn19search10turn19search14  

### BuyerRecon 需要落地的五个交付物

| 交付物 | v1 应包含什么 |
|---|---|
| build contract | 事件名、字段、必填/选填、site/project/workspace 作用域、owner、版本号、变更日志、删除路径。 |
| test plan | 负面授权测试、删除 dry-run/execute 测试、retention 边界测试、审计必写测试、监控心跳测试。 |
| runtime proof | request_id、workspace/project/site、decision、reason codes、rule/model version、evidence refs、timestamp。 |
| Codex review checklist | 新表是否带 workspace_id；新写路径是否写 audit；新日志是否去敏；新 job 是否有 heartbeat；新 API 是否有 role matrix。 |
| rollback path | retention/deletion job 可关；site ingest 可暂停；新角色发布可回滚；新指标/告警可静默；配置变更可回到 last-known-good。 |

## 最终基准与限制

### Final benchmark

| Module | Market benchmark | BuyerRecon v1 minimum | Evidence-grade improvement | Not-now / defer |
|---|---|---|---|---|
| 数据保留 | Clarity/Matomo/Segment/RudderStack 都做分层 retention。 | 原始请求体 0 天；规范化证据 30 天；证明 180 天；审计 365 天。 | 证明记录独立于原始证据，客户可看到“为何判定”。 | 客户自定义 retention 套餐。 |
| 审计日志 | PostHog/Segment/RudderStack/Supabase/Auth0/Keycloak 都有管理审计。 | append-only `audit_events`。 | 配置变更保留 before/after hash，删除有 completion receipt。 | SIEM 深集成、客户自定义审计导出。 |
| 删除工作流 | Segment/RudderStack 强调 delete + suppress。 | verified request → dry-run → approve → suppress → execute → verify → receipt。 | 给客户一个可验证删除回执，而不只是“我们已经处理”。 | 自动向所有下游第三方 fan-out。 |
| 监控 | Prometheus + Sentry + Snowplow + Grafana 组合强调症状、job、URL、data quality、SLO。 | collector、DB、scoring、report、deletion、retention、audit 七条链路指标。 | runtime proof 与 observability 共享 request_id / trace_id。 | 复杂 anomaly detection。 |
| incident response | Grafana IRM 强调 timeline、declaration、postmortem。 | 单模板 + severity + commander + timeline。 | 事故中能回答“是否影响证明/删除/审计完整性”。 | 完整 on-call 编排平台。 |
| RBAC / auth | Clarity/Matomo 走固定角色，Auth0/Supabase/Segment 走 least privilege + resource scope。 | 4 个角色 + support break-glass。 | 每次管理动作都形成治理证据。 | 自定义角色、SCIM、ReBAC/FGA。 |
| workspace / project / site 隔离 | PostHog、RudderStack、Segment、Auth0、Keycloak 都强调组织上下文。 | 强制 `workspace_id`；project/site 唯一归属；查询先按 workspace 过滤。 | 每条证明记录可追溯到单一租户与单一 site。 | 跨租户共享与委托管理。 |
| 政策文档 | GDPR/OWASP 要求可证明、可解释。 | internal access policy、secrets handling policy、data processing record、security review checklist 四份短文档。 | 政策直接映射到表、job、测试和审计事件。 | 厚重 GRC 系统。 |

### 开放问题与局限

本次结论优先采用官方文档与官方帮助中心中的高置信模式；少数厂商更深层的 enterprise 细节在公开资料中只做高层描述，因此矩阵中部分“高级审计 / 精细权限 / 删除下游 fan-out”的可用性与限制仍应在 BuyerRecon 真正采购或集成前再做一次实现级核对。citeturn31view9turn31view10turn20search2turn22search13

**最终判断**：  
BuyerRecon 的最小可信治理，不是“企业合规壳子”，而是这套具体落地物：  
- 一份 build contract。  
- 一张 append-only audit 表。  
- 一个 delete + suppress 工作流。  
- 一组覆盖 collector / DB / scoring / reporting / retention / deletion 的监控与阈值。  
- 一个 4 角色、3 层边界的授权模型。  
- 一份 incident timeline 模板。  
- 四份很短但可执行的政策文档。  

做到这些，BuyerRecon 就已经跨过“闭门造车”与“过早企业化”之间最关键的可信门槛。