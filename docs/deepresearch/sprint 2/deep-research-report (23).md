# BuyerRecon Sprint 2 公开模式深研报告

## 执行摘要

本轮公开资料显示，成熟产品在“行为 → 信号 → 判定”这条链路上，普遍不会把单一事件直接包装成结论，而是把**原始行为采集**、**多源风险聚合**、**分层评分/分类**与**人工复核或规则覆盖**拆开。做得最成熟的厂商会把**行为证据**与**运营动作**解耦：先记录、再归因、再评分、最后才做拦截或排除；并且会公开承认自己输出的是**概率、置信度、风险分层**，而不是“100% 真相”。这一点在 urlCloudflare Bot Managementturn9search2 的 1–99 bot score、urlFingerprint Smart Signalsturn7view2 的 Suspect Score、urlHUMAN Bot Defenderturn21view1 的 risk score、以及 urlTrafficGuard Threats reportturn16view2 的 threat reason 分层里都很明显。citeturn10view0turn7view2turn21view1turn16view2

对 BuyerRecon 来说，最重要的结论不是“谁检测最准”，而是**哪些模式最适合做 evidence-first 的 buyer-motion verification 层**。高置信模式包括：把 reload 和 SPA route change 分开；把 focus/visibility 与交互行为分开；把 client hints 与 server evidence 分开；把坏机器人验证 Lane A 与好/中性 AI agent 观测 Lane B 分开；把 score 与 reason code 一起返回；把低置信判定默认留在 `RECORD_ONLY`。这些模式均可从公开文档中得到强支撑，而不需要侵入式指纹或黑盒 ML 先行。citeturn5search1turn5search0turn10view3turn10view2turn33search3turn13view2turn16view2

### 行为信号十大教训

1. **“刷新”应当先被建模为浏览器导航类型，而不是简单重复 page_view。** `PerformanceNavigationTiming.type` 可区分 `reload`、`navigate`、`back_forward`；GA4 也明确把历史变更与手动 page_view 视作独立控制点。citeturn5search1turn5search21turn4view1  
2. **可见性与焦点状态是停留/活跃时间的核心，而 `beforeunload`/`unload` 不可靠。** GA4 的 user engagement 依赖页面在前台/有焦点；MDN 与 web.dev 都建议优先用 `visibilitychange`，而不是 `beforeunload`。citeturn3view2turn5search0turn5search3turn5search2  
3. **成熟回放工具的最小公共采集面是：DOM 变化、点击/输入、滚动、窗口变化。** rrweb、Clarity、Sentry 都建立在这一层之上。citeturn24view0turn23view0turn26view2  
4. **“rage click / dead click” 是经验规则，不是自然常量。** Hotjar 用“同一元素 500ms 内 5 次点击”，Clarity 用“聚簇区域内快速多次点击”，Sentry 用“dead element 上反复点击且 7 秒无页面活动”。BuyerRecon 应保存原始特征，不应绑定单一阈值。citeturn1view7turn1view0turn27search1  
5. **同文档导航与硬导航必须分开。** OpenTelemetry 的 browser navigation 明确区分 `same_document`、`hash_change`、`push/replace/reload/traverse`。citeturn32view0  
6. **SPA/manual pageview 的双计数是真实风险。** GA4 明确警告：若未关闭自动 pageview 又手发 `page_view`，会产生重复 pageview。citeturn4view1  
7. **“页面离开”不应只靠 unload 型事件。** PostHog 需要 `$pageleave` 才能正确计算 bounce；Sentry 用 `sessionStorage` 让 replay 跨 refresh 持续同一 tab 会话。citeturn1view3turn26view2turn27search7  
8. **资源时序与 Web Vitals 是强上下文，不是意图证明。** PostHog、Sentry、OpenTelemetry 都采集性能/资源指标，但这些指标本身更适合作为辅助证据。citeturn1view2turn27search6turn30view2turn30view4  
9. **隐私遮罩是默认能力，而不是后补治理。** Clarity 默认遮罩敏感内容；Sentry 默认对 replay 文本、输入与图像做强遮罩。citeturn23view0turn23view1turn26view2turn27search4  
10. **“同 URL 重复访问”在分析层可能被当成正常浏览，因此 BuyerRecon 需要单独建 refresh-loop 特征。** GA4 明确 repeated views 仍计入 screen/page views；TrafficGuard 甚至把“重复广告点击但是真人”单列为 non-incremental engagement。citeturn3view4turn16view1  

### 机器人/欺诈十大教训

1. **client-only 检测只能做一层，不足以支撑最终裁决。** BotD 开源版是浏览器端；其 Pro/Smart Signals 需要服务端 API 校验；Cloudflare、HUMAN、DataDome 都明确混用客户端与服务端证据。citeturn7view0turn7view2turn10view3turn10view4turn21view0turn13view0  
2. **成熟系统都在混合：签名/启发式/行为/ML/全网情报。** 这是当前行业共同模式。citeturn10view1turn10view5turn21view0turn13view1turn19view2  
3. **“好机器人”被单独验证，不和坏机器人共用同一逻辑。** Cloudflare 有 verified bots 与 signed agents；Fingerprint Pro 区分 good/bad/not detected；DataDome 允许 good bots/partner bots。citeturn10view2turn33search3turn7view1turn12search3  
4. **JavaScript 检测有价值，但经常只是证据，不会自动执行封禁。** Cloudflare 文档明确说 JS Detections 即便失败，也需要你自己再写 WAF 规则。citeturn10view3  
5. **单用 IP/数据中心/代理信誉，假阳性很高。** Cloudflare 新模型强调“不依赖 IP blocking”；TrafficGuard 也把一类“重复点击真人”与 bot/malware 分开。citeturn10view5turn16view1  
6. **GIVT/SIVT 分层仍然是公开产品里的通用语义层。** TrafficGuard 与 HUMAN 都公开采用这套分类，并继续细分到具体 threat category。citeturn16view0turn21view3  
7. **“重复点击”本身不是 bot 结论。** TrafficGuard 的 non-incremental engagement 明确包含 genuine users 的 repeated/excessive ad click。citeturn16view1  
8. **敏感上下文才适合升到 invisible device check / challenge。** DataDome 只在 suspicious request 或风险资源上下文触发 Device Check。citeturn13view0  
9. **系统故障时的 fail-soft/fail-open 很关键。** DataDome Akamai 模块在超时或处理错误时默认按 200 放行，优先保护正常用户体验。citeturn13view3  
10. **不要对“bot certainty”过度宣传。** Cloudflare 用 likelihood score，Fingerprint 用 suspect score，学术研究还显示高级 evasive bots 对 BotD/DataDome 都有显著绕过率。citeturn10view0turn7view2turn6academia20  

### 评分十大教训

1. **成熟产品公开展示的通常是“分数 + 类别 + 行动接口”，不是一串不可解释的模型输出。** Cloudflare、Fingerprint、HUMAN、TrafficGuard 都如此。citeturn10view0turn10view4turn7view2turn21view1turn16view2  
2. **分数更像行动优先级，而不是事实本体。** Cloudflare 分数用于 WAF/Workers 规则；Fingerprint 明说不建议在客户端直接根据 Suspect Score 决策。citeturn10view0turn7view2  
3. **reason codes / indicators 是运营信任的关键。** TrafficGuard 给每个 invalid click 赋具体 threat reason；HUMAN 公开 bot indicators/capabilities/IP origin；Cloudflare 公开 bot tags 与 detection IDs。citeturn16view2turn21view2turn10view4turn10view6  
4. **服务端验证是正式评分链路的主战场。** Fingerprint Smart Signals 从服务端 API 返回；HUMAN 的 risk score 进加密 cookie 再给 enforcer；Cloudflare 评分在边缘/WAF/Workers 使用。citeturn7view2turn21view1turn21view4turn10view0turn10view4  
5. **UX 产品往往给的是事件标签，不是总分。** Clarity、PostHog、Hotjar、Sentry 公共文档更透明的是 frustration/event labels。citeturn1view0turn1view2turn1view6turn27search1turn27search6  
6. **GA4 的 engagement 类分数是阈值度量，不是 buyer intent。** 10 秒、key event、2+ page views 这些规则非常容易被刷新、多页切换或脚本行为误导。citeturn3view0turn3view4  
7. **高成熟度产品都给“覆盖规则”的能力。** Cloudflare 有自定义规则，DataDome 有 custom rules，TrafficGuard 有 filter/export/segment，HUMAN 有运营与 SOC 介入。citeturn10view4turn13view2turn16view2turn21view5  
8. **最好的 explainability 发生在“会话/请求/元素选择器”层，而不是“账户总分”层。** Sentry 的 Most Dead/Rage Click selectors、TrafficGuard threat rows、Hotjar actions list 都是这个思路。citeturn27search1turn16view2turn1view6  
9. **分数演进需要版本化。** OpenTelemetry 连语义约定都显式做迁移窗口；BuyerRecon 的 scoring 同样应 versioned，而不是静默换规则。citeturn31view1turn30view3  
10. **BuyerRecon v1 最安全的评分方式是 deterministic rubric，不是黑盒 ML。** 公开市场已经证明透明 reason layer 才是运营可落地形态，而黑盒只是内部实现。citeturn16view2turn21view2turn10view4  

### AI Agent 流量十大教训

1. **AI 访问者生态已经分裂成“声明型 crawler / user-triggered fetcher / 签名代理 / 浏览器型 agent”几类。** 这不是单一 bot taxonomy 能覆盖的。citeturn33search0turn33search3turn20search16  
2. **Google-Extended 只是 robots.txt token，不是单独的 HTTP User-Agent。** 所以仅靠 UA 字符串无法完整辨识 Google 侧 AI 用途。citeturn36search0  
3. **OpenAI 已公开把 AI crawler 控制暴露给站长。** 官方文档说明 OpenAI 使用 crawler/user agents，并使用 OAI-SearchBot 与 GPTBot robots.txt tags 供网站控制。citeturn33search0  
4. **Anthropic 公开承认使用 ClaudeBot 获取训练数据，并称其遵守 robots.txt；但公开的 crawler 运维细节分散。** 这意味着 BuyerRecon 对 Anthropic 侧只能做“声明型识别 + 低假设”。citeturn35search3  
5. **Cloudflare 已把“signed agents”做成独立实体。** 其定义是“由终端用户控制、通过 Web Bot Auth 签名验证的 bot”。citeturn33search3  
6. **HUMAN 已在广告 IVT taxonomy 中把 AI Agents 作为 known crawler 子类公开列出来。** 这说明市场已经开始把“AI agent”从泛 bot 中拆出来。citeturn21view3  
7. **DataDome 公开把“trusted AI agents”与 malicious bots 并列区分。** 其产品页与自定义规则页都直接出现 Agent Trust 语义。citeturn13view1turn13view2  
8. **“浏览器型 agent”会削弱纯 UA/纯 headless 识别。** HUMAN 对 Google Mariner 的说明表明，某些 agent 已经运行在真实浏览器/虚拟机环境中。citeturn20search16  
9. **BuyerRecon 必须把 Lane A 与 Lane B 从数据结构上拆开。** 公开市场已证明 good bot / signed agent / AI agent 与 bad bot 的规则不同。citeturn10view2turn33search3turn12search3turn13view1  
10. **AI agent 分类在 v1 最安全的做法是：声明优先、验证优先、行为推断降级为 observational。** 这是对公开控制能力与误判风险的最稳妥回应。citeturn36search0turn33search0turn33search3turn20search16  

## 事实与模式

### 刷新循环与重复 pageview 遥测

**Fact**  
公开资料中，最可靠的刷新与页面生命周期信号来自浏览器原生 API，而不是分析平台的衍生指标。`PerformanceNavigationTiming.type` 可以直接给出 `reload` / `navigate` / `back_forward`；GA4 的 `page_view` 既会在页面加载时自动发，也可能在 history state change 时自动发；OpenTelemetry 的 browser navigation 又会额外把 SPA route change 标成 `same_document=true`，并保留 `reload` / `traverse` 等类型。换句话说，同一个“又看到了这个 URL”背后，至少可能是**硬刷新、历史回退、SPA soft nav、手动双发 pageview**四种完全不同的语义。citeturn5search1turn4view1turn32view0

Clarity、Hotjar、Sentry、PostHog 这类行为工具普遍不把“刷新循环”当成一级公开概念，而是公开更底层的挫败模式：rage click、dead click、quick back/U-turn、pageleave、recording actions、timeline breadcrumbs。rrweb 的开源说明则更直接：它记录 DOM changes、mouse interaction、scroll、window size changes、input，并使用 `MutationObserver`、事件监听和 setter hook 处理程序性变更。Sentry 还说明 replay session 可跨 refresh 继续存在于同一 tab，前提是 SDK 重新初始化且 tab 未关闭。citeturn1view0turn1view7turn1view2turn24view0turn27search7

**Inference**  
这意味着 BuyerRecon 不应把“连续同 URL page_view”直接解释成 refresh-loop，也不应照搬某个厂商的 rage/dead 点击阈值。更稳的做法，是先采集**导航类型、同 tab continuity、同 URL 连续访问、前一页面可见性、最后一次有效交互时间、是否发生页面响应**，再由 feature extraction 层推导 refresh-loop。否则你会把 SPA route replace、浏览器 back-forward cache、埋点双发、甚至真人的重复 F5 行为混到一起。citeturn4view1turn5search1turn24view0turn26view2

**Recommendation**  
BuyerRecon v1 的最小行为遥测应只收集**证据级底层字段**：  
- 页面进入：`nav_type`, `same_document`, `hash_change`, `page_url`, `referrer`, `route_key`, `tab_session_id`  
- 页面状态：`visibility_state`, `focus_state`, `hidden_duration_ms`, `foreground_duration_ms`  
- 交互计数：`click_count`, `input_count`, `scroll_count`, `dead_click_candidate_count`, `rage_cluster_count`  
- 连续性：`consecutive_same_url_views`, `consecutive_reload_count`, `time_since_last_meaningful_input_ms`  
- 响应性：`dom_mutation_after_click`, `network_after_click`, `js_error_after_click`, `resource_timing_summary`  
- 会话切割：`is_refresh_continuation`, `is_history_traverse`, `is_spa_route_change`  

BuyerRecon 不应在 v1 里把 “rage click = intent” 或 “2+ page views = engagement” 直接吸收为真值层。那是分析层指标，不是验证层证据。citeturn3view0turn3view4turn1view0turn1view7turn27search1

**Open decision for Helen**  
Helen 需要拍板：BuyerRecon 是否要在 v1 就引入**tab 级连续性**（例如 `sessionStorage` continuity）作为一等公民。如果不做，就几乎无法把“真人连按刷新”和“跨页二次进入同 URL”可靠区分开。Sentry 已公开证明同 tab continuity 对 replay 生命周期有价值。citeturn26view2turn27search7

### 欺诈与 bot 信号聚合

**Fact**  
成熟 bot/fraud 产品公开暴露出来的共同模式，是**浏览器端轻采集 + 服务端复核 + 规则/评分输出**。Fingerprint 的 Smart Signals 明确通过 Server API 返回，而不是直接信任客户端；Cloudflare 把 score、verified bot、JA3/JA4、detection IDs 暴露给 WAF/Workers；HUMAN 用 Sensor → Detector → Enforcer 的链路，把 risk score 放进加密 cookie；DataDome 则强调每次请求都会用数百个客户端和服务端信号持续评估风险。citeturn7view2turn10view4turn21view1turn21view4turn13view1

公开文档也反复强调：**很多高价值证据根本不在前端。** Cloudflare 的 verified bots 依赖 Web Bot Auth、IP validation、reverse DNS、ASN blocks 与内部数据；Cloudflare 还公开暴露 JA3/JA4 指纹；HUMAN 的 detector 与 enforcer 是边缘/源站链路；DataDome 的 Device Check 只在 suspicious context 下再补客户端检查；TrafficGuard 用 200+ signals 结合 always-on ML，并把 invalid / filtered / success 数据拆开。citeturn10view2turn10view4turn13view0turn16view1turn16view3

**Inference**  
BuyerRecon 若坚持“evidence-first”，就不该把 `navigator.webdriver`、UA、data-center IP、无交互、单次 reload burst 这类信号直接当作阻断依据。它们更适合是**fraud_signal object 的 observation slots**。真正可以提升置信度的，是不同来源的独立证据相互 corroborate：例如**HTML 页面上 JS 检查失败 + 服务端 header/TLS 异常 + 重复相同行为 cadence**。这一点既符合 Cloudflare/HUMAN/DataDome 的公开架构，也能避免把无障碍工具、隐私浏览器、代理网络、企业出口 NAT 误伤成 bot。citeturn10view3turn10view5turn21view2turn13view0turn6academia20

**Recommendation**  
BuyerRecon v1 应把 bot/fraud 信号分成三层：  

- **client_observable_safe**：页面是否执行 JS、导航类型、visibility/focus、点击/输入/滚动 cadence、dead/rage candidates、console/js errors、资源加载节奏、明显 automation hints。  
- **server_required**：IP/ASN reputation、TLS fingerprint、header consistency、cookie continuity、route sensitivity、request burst、challenge outcome、verified bot / signed agent / partner allowlist。  
- **observational_only_v1**：canvas/audio/复杂环境伪装、单点指纹异常、仅凭行为推断 AI agent、仅凭 IP/UA 的 bad-bot 结论。  

BuyerRecon v1 **绝不应该声称**：  
- “我们验证了这是人类”  
- “我们精确识别了 AI agent”  
- “我们阻止了欺诈”  
- “这是购买意图高的 buyer”  
除非同时有足够的服务端证据和后验标签。公开市场本身也大多只声称 risk / likelihood / traffic quality，而不是确定性事实。citeturn10view0turn7view2turn21view1turn19view1

**Open decision for Helen**  
Helen 需要确定 BuyerRecon v1 是否允许引入**边缘/WAF/服务器证据**。如果 Sprint 2 只做前端，那么你最多只能交付“可解释的观察层”和“低到中置信 Lane A 建议”，而不是商业上足够硬的 invalid-traffic verification。citeturn10view4turn21view4turn13view1

### 评分 worker、reason code 与置信带

**Fact**  
公开市场上，最可用的评分不是“一个总分”，而是“**总分/分类 + 原因字典 + 运营接口**”。Cloudflare 给 1–99 bot score 并允许基于分值写规则；Fingerprint 用 weighted average 做 Suspect Score；HUMAN 把 risk score 发送给 Enforcer 决定 allow/block/challenge；TrafficGuard 给具体 threat reason、threat category、CSV 导出与过滤；Sentry、Clarity、Hotjar 等偏 UX 工具则更偏向 event labels 与 selector/session drill-down。citeturn10view0turn7view2turn21view1turn16view2turn27search1turn1view0turn1view6

**Inference**  
BuyerRecon 如果想比竞品“更 evidence-grade”，关键不在于把分数做得更复杂，而在于**把分数的可复算性做透**：同一输入、同一 scoring version、同一阈值，任何时间都应复算出同样的输出。这和 OpenTelemetry 对 semantic conventions/migration 的处理逻辑是类似的：版本化、迁移窗口、双写期，而不是静默魔法。citeturn31view1turn30view3

**Recommendation**  
BuyerRecon v1 的 scoring worker 采用**确定性加权 + reason code 驱动**最安全。建议：  

- **不要输出单一“intent score”**；输出两个内部分量：  
  - `lane_a_invalid_traffic_score`  
  - `lane_b_declared_agent_score`  
- **最终 customer-facing 只输出 Lane A 相关验证结果**；Lane B 仅内部观测。  
- **所有 score 都要带**：  
  - `reason_codes[]`  
  - `evidence_refs[]`  
  - `confidence_band`  
  - `scoring_version`  
  - `action_recommendation`  

一个稳妥的 v1 规则是：  
- **High confidence**：至少 1 个强服务端或验证型信号 + 1 个独立行为或客户端 corroboration。  
- **Medium confidence**：2 个以上独立信号族，但缺少显式验证。  
- **Low confidence**：仅单家族信号、仅客户端、或仅行为类推断。  

这样做比“黑盒 ML 出 0–100”更符合 BuyerRecon 的定位，也更容易进入 Codex review、审计与回滚。citeturn10view0turn7view2turn16view2

**Open decision for Helen**  
Helen 需要决定：BuyerRecon 的 v1 主输出是否叫 **verification score** 还是 **evidence score**。从公开市场的语言看，前者更商业，后者更稳妥；但若叫 verification，就要严格限制可对外声称的能力边界。citeturn10view0turn19view2turn19view1

### AI agent 流量与 Lane B 分离

**Fact**  
公开生态已经同时存在三套不同控制模型：  
- 站长控制型 crawler token，如 OpenAI 的 OAI-SearchBot / GPTBot 与 Google 的 Google-Extended；  
- 平台验证型 good bot / signed agent，如 Cloudflare verified bots / signed agents；  
- 浏览器型/用户触发型 agent，如 HUMAN 公开说明的 Google Mariner 浏览器型 agent。citeturn33search0turn36search0turn33search3turn20search16

同时，广告与 bot 防护厂商已经开始把 AI agent 单独拿出来：HUMAN 在 IVT taxonomy 里列出 AI Agents；DataDome 产品页直接写 trusted AI agents / Agent Trust；Cloudflare signed agents 明确是“终端用户控制、签名验证”的 bot。citeturn21view3turn13view1turn13view2turn33search3

**Inference**  
BuyerRecon 若不把 Lane B 拆出来，短期看似简单，长期一定会出现两个问题：  
- 你会把可接受的 AI crawler / user-triggered fetch / signed agent 错杀进“欺诈”；  
- 你会在客户报表与内部研发语言之间产生长期歧义。  

而且 Google-Extended 这种“robots token 不是独立 HTTP UA”的模式也说明，**AI use control** 与 **网络层识别**不是一回事。citeturn36search0

**Recommendation**  
Lane B 只做四件事：  
- `declared_agent_detected`  
- `declared_agent_family`  
- `verification_method`（例如 signed / reverse DNS / partner allowlist / robots token only）  
- `agent_confidence`  

Lane B 在 v1 **不参与**：  
- live URL 参数  
- UTM  
- GA4 事件名  
- LinkedIn / 广告平台 payload label  
- customer-facing quality reports  

BuyerRecon 只能把 Lane B 作为**内部研究/数据 moat**来积累，不能让任何客户-facing 输出把“AI agent”与“bad bot”混成同一个维度。citeturn10view2turn33search3turn13view1

**Open decision for Helen**  
Helen 需要决定是否在 Sprint 2 就保留 **Lane B schema but dark-launch**。我的建议是保留 schema、不出报表、不进客户接口；否则未来补 lane separation 会非常痛。  

## 市场 / 竞品矩阵

| Product | Behaviour telemetry pattern | Bot/fraud signal pattern | Scoring/quality display | Reason-code transparency | False-positive handling | AI-agent relevance | Source | Confidence |
|---|---|---|---|---|---|---|---|---|
| urlMicrosoft Clarityturn22search11 | DOM/layout + interaction replay；rage/dead/excessive scroll/quick back 等语义指标 | 公开资料未见 bot/fraud 主产品能力 | 更多是语义指标，不是统一质量分 | 中：公开 event labels 明确 | 低：公开文档少见误判治理细节 | 低 | citeturn1view0turn1view1turn23view0 | 高 |
| urlPostHoghttps://posthog.com | autocapture pageview/pageleave/interaction/dead click/session replay/web vitals | 公开主文档未见独立 bot/fraud 评分层 | bounce/LCP/path 等分析指标 | 中：event type 透明，但无统一 reason layer | 低 | 低 | citeturn1view2turn1view3 | 高 |
| urlHotjarhttps://www.hotjar.com | recordings + rage clicks + U-turns + errors + action list | 公开主产品不是 bot/fraud | relevance score 算法在开发中；以过滤/会话分析为主 | 中 | 低 | 低 | citeturn1view6turn1view7 | 中高 |
| urlGoogle Analytics 4turn2search1 | 自动/手动 `page_view`；focus/foreground user engagement；repeated views 被计数 | 非 bot 产品 | engaged session / engagement rate / bounce rate | 低：阈值透明，但非 reason-coded | 低 | 低 | citeturn4view1turn3view0turn3view2turn3view4 | 高 |
| urlFingerprint BotD / Smart Signalsturn7view1 | 开源 BotD 做浏览器端 automation 检测；Pro/Smart Signals 走服务端校验 | good/bad/not detected；Smart Signals & Suspect Score | Suspect Score、bot result | 中：类别公开，但底层细则有限 | 中：推荐服务端使用，区分 good bots | 高 | citeturn7view0turn7view1turn7view2 | 高 |
| urlCloudflare Bot Managementturn9search2 | HTML 页 JS Detections；边缘侧全请求评估；verified bots / signed agents | heuristics + ML + fingerprints + behavioral + JS detections | 1–99 bot score；tags；detection IDs | 高 | 高：verified bots、自定义规则、score threshold | 高 | citeturn10view0turn10view1turn10view2turn10view3turn10view4turn10view6 | 高 |
| urlCHEQturn19view3 | 轻站点 tag；按 interaction 实时评估 | execution environment + behavior + network context + trust intelligence | 更像 traffic quality / fraud prevention 结果 | 中：强调 explainability，但公开字典有限 | 中：低 false positive claim；risk-based decisions | 中 | citeturn19view2turn19view3 | 中 |
| urlLunioturn19view4 | 深平台集成 + granular campaign analytics | ML-powered IVT detection；公开细节较少 | legitimacy reporting | 低 | 低到中：公开机制少 | 中 | citeturn19view4turn19view5 | 中低 |
| urlTrafficGuardturn15search8 | dashboard/reporting 到威胁原因、设备、位置、事务导出 | 200+ signals；GIVT/SIVT；non-incremental / non-genuine / bots-hosts-malware | invalid / filtered / success；threat report | 高：每个 invalid click 都有 threat reason | 中高：分 invalid/filtered/success，保留粒度分析 | 中 | citeturn16view0turn16view1turn16view2turn16view3 | 高 |
| urlHUMAN Securityturn20search1 | Sensor 收集浏览器/设备/行为数据；Detector/Enforcer 实时闭环 | hundreds of signals；behavioral analytics；good bot feed；IVT taxonomy | risk score | 高：bot indicators/capabilities/IP origin 公开 | 高：good bots、SOC、simulated/active block运营语境 | 高 | citeturn21view0turn21view1turn21view2turn21view3turn21view5 | 高 |
| urlDataDometurn12search0 | edge 实时评估 every request；Device Check 做补充验证 | 100s client/server signals；Device Check；Agent Trust | 公共页更偏策略/自动防护，非公开细粒度分数 | 中 | 高：custom rules；rare human challenge；timeout fail-soft | 高 | citeturn13view0turn13view1turn13view2turn13view3 | 高 |
| urlSentry Replayturn27search4 | DOM replay；captures page visits, mouse, clicks, scroll；dead/rage click widgets | 非 bot 产品 | 无统一质量分；以 replay issues/filter 为主 | 中高：selectors、timeline、breadcrumbs | 中：可忽略特定 selector；session sampling | 低 | citeturn26view2turn27search1turn27search4turn27search6turn27search7 | 高 |
| urlOpenTelemetry browser instrumentationturn28search0 | browser.navigation / navigation timing / resource timing / user action / web vitals / errors 标准化事件 | 非 bot 产品 | 无业务分数；提供标准化 schema | 高：schema 与属性透明 | 不适用 | 低 | citeturn30view1turn30view2turn30view3turn30view4turn31view0 | 高 |

## 开源矩阵

| Project | Relevant module | Useful technical pattern | Data fields | Testing approach | Risk/complexity | BuyerRecon applicability |
|---|---|---|---|---|---|---|
| urlmicrosoft/clarityhttps://github.com/microsoft/clarity | `clarity-js`, `clarity-decode`, `clarity-visualize` | 采集层、解码层、可视化层明确分离；默认遮罩；layout + interaction + network request inspection | layout/viewport/interactions/network/log payloads | 公开 repo 可见 `test` 目录与 Playwright 配置；适合借鉴 replay/integration 测试结构。citeturn23view0 | 中高：自建 full replay 成本高 | **高**：借鉴分层、遮罩、解码，不必自造完整 replay |
| urlrrwebhttps://github.com/rrweb-io/rrweb | record / replay / snapshot | `MutationObserver` 处理 DOM 变更；mousemove 双层节流；input/change + setter hook；事件时间校准 | DOM add/remove/attr/text、mouse、scroll、resize、input | 公开文档更强调事件模型；BuyerRecon 可借它做 golden replay / mutation ordering 测试。citeturn24view0 | 中高：mutation 去重与顺序处理复杂 | **很高**：最适合 BuyerRecon 的 feature extraction 基座 |
| urlFingerprint BotDhttps://github.com/fingerprintjs/BotD | browser bot detector | client-only automation hints；开源/Pro 边界清晰；把 server-side accuracy 提升单独留给 Pro | bot boolean / kind；automation framework families | 可用已知自动化框架与 stealth 插件做对抗回归；公开支持矩阵可直接成为 harness 样本集。citeturn8view1turn8view2 | 中：单靠它误判/绕过风险高 | **中高**：适合做 observation slot，不适合单独裁决 |
| urlOpenTelemetry Browser Instrumentationhttps://github.com/open-telemetry/opentelemetry-browser | navigation / resource-timing / user-action / web-vitals / errors | 统一事件 schema；SPA/full load 区分；resource timing buffered + visibility flush；`data-otel-*` 扩展属性 | `browser.navigation.*`、resource timing、click action、web vitals、console/errors | 适合做 schema/compatibility 测试；公开语义定义利于 contract test。citeturn32view0turn30view2turn30view4 | 中：规范 still experimental | **很高**：BuyerRecon 合同命名与事件层推荐直接借鉴 |
| urlOpenTelemetry document-load instrumentationhttps://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load | `instrumentation-document-load` | 首次 HTML load 与前后端 traceparent 关联；`documentLoad/documentFetch/resourceFetch` 分层 | URL、User-Agent、fetch/resource spans、自定义属性 | 适合做 first-load tracing 与 refresh-loop root-cause 测试；可做 span parity 回归。citeturn31view0turn31view1 | 中 | **高**：非常适合 BuyerRecon 的 runtime proof |
| urlSentry Session Replay SDK docshttps://docs.sentry.io/guides/session-replay/ | replay lifecycle / rage-dead-click surfacing | sessionStorage 跨 refresh；inactivity timeout；selector-level dead/rage 聚合；timeline + breadcrumbs | page visits / clicks / scrolls / navigations / errors / selectors | 可借鉴 selector 聚合与 inactivity 边界测试；公开采样规则也适合 RECORD_ONLY 设计。citeturn26view2turn27search1turn27search7 | 中 | **高**：适合 false-positive review 与 runtime proof 交互层 |

## BuyerRecon Sprint 2 推荐合同

### 合同设计原则

**Fact**  
公开成熟工具几乎都在做三件事：先记录原始事件，再生成派生信号，最后输出可执行但可覆盖的分数或类别。并且从 GA4 到 OTel，再到 Cloudflare/HUMAN/TrafficGuard，都把**schema、score、执行规则**拆开。citeturn4view1turn30view3turn10view4turn21view4turn16view2

**Inference**  
BuyerRecon 的“evidence-first”优势，应该体现在**合同层天然支持可复算、可审计、可回滚**，而不是多做几个 signal。  

**Recommendation**  
下面这份合同按“原始页面事件 → 派生特征 → 风险对象 → 评分输入/输出 → 复核/版本”拆分，专门为 Sprint 2 的三件主任务服务：刷新循环、bot/fraud 聚合、评分 worker。  

### 推荐字段合同

```json
{
  "page_view": {
    "event_id": "uuid",
    "occurred_at_ms": 0,
    "page_url": "string",
    "page_path": "string",
    "referrer": "string|null",
    "route_key": "string",
    "tab_session_id": "string",
    "page_instance_id": "string",
    "nav": {
      "type": "navigate|reload|back_forward|prerender|unknown",
      "same_document": true,
      "hash_change": false,
      "history_change_kind": "push|replace|traverse|none",
      "is_manual_pageview": false
    }
  },

  "page_state": {
    "visibility_state": "visible|hidden|prerender|unknown",
    "has_focus": true,
    "foreground_duration_ms": 0,
    "hidden_duration_ms": 0,
    "last_visibility_change_ms": 0,
    "window_size": { "w": 0, "h": 0 },
    "viewport_size": { "w": 0, "h": 0 }
  },

  "refresh_loop": {
    "consecutive_same_url_views": 0,
    "consecutive_reload_count": 0,
    "same_url_window_ms": 0,
    "reload_streak_window_ms": 0,
    "has_meaningful_interaction_before_reload": false,
    "time_since_last_meaningful_input_ms": null,
    "back_forward_count": 0,
    "spa_route_change_count": 0
  },

  "feature_extraction": {
    "interaction": {
      "click_count": 0,
      "input_count": 0,
      "scroll_count": 0,
      "max_scroll_depth_pct": 0,
      "rage_cluster_count": 0,
      "dead_click_candidate_count": 0
    },
    "response": {
      "dom_mutation_after_click_count": 0,
      "network_after_click_count": 0,
      "js_error_count": 0,
      "resource_error_count": 0
    },
    "timing": {
      "page_active_ms": 0,
      "idle_ms": 0,
      "time_to_first_interaction_ms": null,
      "time_to_last_interaction_ms": null
    },
    "env": {
      "js_executed": true,
      "webdriver_hint": false,
      "headless_hint": false,
      "user_agent_declared_bot_hint": false
    }
  },

  "fraud_signal": {
    "client_observations": [
      { "code": "A_AUTOMATION_HINT", "present": false, "evidence": [] }
    ],
    "server_observations": [
      { "code": "A_BAD_NETWORK_REPUTATION", "present": false, "evidence": [] },
      { "code": "A_TLS_HEADER_MISMATCH", "present": false, "evidence": [] },
      { "code": "A_CHALLENGE_FAILED", "present": false, "evidence": [] }
    ],
    "verified_agent": {
      "is_verified_good_bot": false,
      "is_signed_agent": false,
      "verification_method": "none|reverse_dns|ip_validation|web_bot_auth|partner_allowlist"
    }
  },

  "scoring_input": {
    "lane_a_invalid_traffic_features": {},
    "lane_b_agent_features": {},
    "version": "s2.v1"
  },

  "scoring_output": {
    "lane": "A_INVALID_TRAFFIC|B_DECLARED_AGENT|HUMAN_UNKNOWN|REVIEW",
    "score": 0,
    "confidence_band": "low|medium|high",
    "reason_codes": [],
    "evidence_refs": [],
    "action_recommendation": "record_only|review|exclude|allow",
    "scoring_version": "s2.v1"
  },

  "false_positive_review_queue": {
    "queue_id": "uuid",
    "status": "open|confirmed_fp|confirmed_tp|needs_server_data|closed",
    "owner": "string|null",
    "notes": "string|null"
  }
}
```

### reason-code dictionary

| Code | Lane | Meaning | Minimum evidence rule |
|---|---|---|---|
| `A_REFRESH_BURST` | A | 同 URL 短窗口重复 reload | `nav.type=reload` + streak/window |
| `A_NO_MEANINGFUL_INTERACTION` | A | 重复进入但无有效交互 | reload/same-url + click/input/scroll 极低 |
| `A_DEAD_CLICK_CLUSTER` | A | 点击后持续无页面响应 | click + no DOM/network response |
| `A_AUTOMATION_HINT` | A | 浏览器/环境出现明显 automation hint | 仅 observation，单条不能高置信 |
| `A_CHALLENGE_FAILED` | A | JS/device challenge 明确失败 | 服务端或边缘 challenge outcome |
| `A_BAD_NETWORK_REPUTATION` | A | 网络来源高风险 | 仅与其他证据组合使用 |
| `A_TLS_HEADER_MISMATCH` | A | TLS/headers/browser 语义不一致 | 服务端证据 |
| `A_BEHAVIORAL_CADENCE_ANOMALY` | A | 交互节奏显著异常 | 行为证据，需配合至少一条别的 family |
| `B_DECLARED_AI_CRAWLER` | B | 公开声明型 AI crawler/robots token | declared identity |
| `B_SIGNED_AGENT` | B | 用户控制且已签名验证的 agent | signed/Web Bot Auth/partner proof |
| `B_USER_TRIGGERED_FETCH` | B | 用户触发型 fetch/agent visit | 仅在声明或合作方验证下使用 |
| `REVIEW_POSSIBLE_FALSE_POSITIVE` | REVIEW | 证据冲突或敏感场景 | score band 不高于 medium |

### 置信带规则

**Recommendation**  
- **High**：出现 verified/signed/challenge outcome/强服务端证据中的至少一条，且被独立行为或客户端证据 corroborate。  
- **Medium**：至少两类独立信号族命中，但无显式验证。  
- **Low**：只命中单一信号族、只来自客户端、或只是 AI/browser automation 的推断。  
- **Lane B 默认不出 High negative judgement**：也就是不允许“高置信 AI=坏流量”这种混合结论。  

### Lane 分离规则

**Recommendation**  
- 内部统一保留两个字段：`lane` 与 `reason_codes`。  
- 任何对外 payload、live URL、GA4 event、UTM、LinkedIn label、customer report 只允许 Lane A。  
- Lane B 只进入内部仓、调试台、研究仪表盘和 review queue。  
- 若同一事件同时命中 Lane A 与 Lane B，**最终 customer-facing 以 Lane A 风险为准，Lane B 只保留内部注释**。  

## 测试计划、运行时证明、Codex review checklist 与回滚路径

### 测试计划

**Fact**  
公开项目已经给了 BuyerRecon 明确的测试靶标：rrweb 的 DOM/event 边界、Sentry 的 refresh continuity 与 dead/rage surfacing、Cloudflare/DataDome/HUMAN 的 challenge/verified bot/operator override 模式，都说明这个问题适合做“事件重放 + 规则对抗 + 影子评分”测试，而不是只写单元测试。citeturn24view0turn27search7turn10view3turn13view2turn21view5

**Recommendation**  
Sprint 2 测试计划至少包含五层：  

1. **字段合同测试**  
   - 所有 `page_view/nav/page_state` 字段在 hard nav / SPA nav / hash change / refresh / back-forward 下都存在且语义正确。  

2. **浏览器行为测试**  
   - Chrome / Safari / Firefox；桌面与移动端。  
   - 专测 `visibilitychange`、tab background、history traversal、manual pageview、double-fire 防重。  

3. **对抗测试**  
   - Playwright / Selenium / Puppeteer / headless Chrome / stealth plugin。  
   - declared good bots、verified bots、无 JS、代理/VPN、企业 NAT、监控探针。  

4. **RECORD_ONLY 影子评分**  
   - 先不执行处置动作，只记录 score、reason、confidence，并与人工 review 或后验标签比对。  

5. **误判回归测试**  
   - 真实用户高频刷新  
   - 支付/工单/看板页面正常重复访问  
   - 无障碍/辅助技术  
   - 内容加载慢但是真人  
   - adblock/隐私浏览器  
   - 已声明 AI crawler 与 signed agent  

### adversarial RECORD_ONLY harness

**Recommendation**  
专门建立一个 `adversarial_record_only` harness，分四个桶：  
- **Human noisy**：真实人类快速刷新、连点、切 tab、后退前进、网络慢。  
- **Declared agents**：承认身份的 crawler / signed agent / partner bot。  
- **Browser automation**：Playwright/Selenium/Puppeteer/headless/stealth。  
- **Server anomaly only**：有坏 reputation/TLS/headers 异常但前端行为正常。  

harness 输出不做封禁，只比较：  
- `score`  
- `confidence_band`  
- `reason_codes`  
- 是否进入 `review`  
- 与人工标注是否一致  

### 运行时证明

**Recommendation**  
BuyerRecon 的 runtime proof 应该是“**任何输出都可以回放与复算**”。最少包含：  
- 原始事件 bundle  
- feature extraction 快照  
- `scoring_version`  
- 规则阈值快照  
- `reason_codes`  
- `evidence_refs`  
- 可选 replay / timeline 链接  

如果运营质疑某次判定，系统必须支持：  
1. 拉回原始事件；  
2. 用同版本 scorer 复算；  
3. 对照 reason code 字典；  
4. 给出“为什么命中”和“为什么不是别的结果”。  

这就是 BuyerRecon 相比 generic dashboard 的真正差异化。

### Codex review checklist

**Recommendation**  
Codex review checklist 建议写死为以下项：  

- 不允许把 `beforeunload` / `unload` 作为关键证据。  
- 不允许单独用 `navigator.webdriver`、IP reputation、UA、无交互判定为 bad bot。  
- 不允许 Lane B 字段出现在任何 customer-facing 输出。  
- 不允许 `score` 无 `reason_codes`。  
- 不允许 `reason_codes` 无 `evidence_refs`。  
- 不允许 silent 修改评分规则；必须 bump `scoring_version`。  
- 不允许 collector/scorer 故障导致页面功能受损；默认 fail-soft。  
- 不允许采集与 BuyerRecon 合同无关的高敏个人数据。  
- 必须有 replay/golden fixture 覆盖 refresh、SPA、back-forward、slow page、headless。  
- 必须有 false-positive review queue。  

### 回滚路径

**Recommendation**  
回滚设计用“分层 kill switch”，不要只有总开关：  

- `disable_feature.refresh_loop`  
- `disable_feature.dead_click_rules`  
- `disable_feature.client_automation_hints`  
- `force_action.record_only=true`  
- `disable_lane_b_exports=true`  
- `scoring_version=previous`  
- `skip_scoring_worker=true`（仅保留原始遥测）  
- `collector_minimal_mode=true`（只保留 page_view/page_state）  

最关键的回滚原则是：**宁可退回原始采集 + RECORD_ONLY，也不要让低置信规则继续污染下游数据或客户信任。** DataDome 的 fail-soft 集成模式已经证明，保护正常流量优先级必须高于“硬拦截的一时爽”。citeturn13view3

## 学习路径与最终基准

### 学习路径

BuyerRecon 团队接下来最该系统学习的能力栈是：

- 行为遥测建模  
- 浏览器生命周期 API  
- Navigation/Resource/Performance Timing  
- DOM mutation 与输入事件采集  
- bot/fraud signal design  
- server-side corroboration 设计  
- feature engineering 与 signal family 划分  
- deterministic scoring 设计  
- reason-code 生成与治理  
- false-positive 分析  
- AI-agent taxonomy 与验证方法  
- adversarial testing / shadow evaluation  

### 最终基准

| Module | Market benchmark | BuyerRecon v1 minimum | Evidence-grade improvement | Not-now / defer |
|---|---|---|---|---|
| Refresh-loop telemetry | GA4 区分自动/手动 pageview；OTel 区分 same-document/reload；Sentry 会话跨 refresh。citeturn4view1turn32view0turn27search7 | 记录 `nav_type`、same-url streak、tab continuity、meaningful interaction | 输出 refresh-loop 的**可解释证据链**而不是仅重复 pageview 数 | 不做完整 replay 产品化 |
| Fraud/bot aggregation | Cloudflare/HUMAN/DataDome 都做 client+server 聚合。citeturn10view4turn21view1turn13view1 | client safe observations + server corroboration slots | 明确区分 observation / verified / inferred | 不做黑盒大模型裁决 |
| Scoring worker | Cloudflare 1–99；Fingerprint Suspect Score；TrafficGuard threat reason。citeturn10view0turn7view2turn16view2 | deterministic score + confidence band + reason codes | 同版本可复算、可审计、可回滚 | 暂不做复杂 ML ensemble |
| Reason-code dictionary | TrafficGuard/HUMAN/Cloudflare 公开 reason/indicator 语义。citeturn16view2turn21view2turn10view6 | 12–20 个稳定 code | 每个 code 绑定 evidence rule 与 review path | 暂不做动态 auto-generated reasons |
| False-positive review | verified bots/custom rules/simulated block/fail-soft 是成熟模式。citeturn10view2turn13view2turn21view5turn13view3 | review queue + RECORD_ONLY | FP 能回溯到具体证据与 scorer 版本 | 暂不做全自动自学习调权 |
| Confidence bands | 市场普遍输出 score/likelihood/risk，而非绝对真值。citeturn10view0turn7view2turn21view1 | low/medium/high 三档 | 用“证据结构”而不是主观口径定义 confidence | 暂不做概率校准曲线外宣 |
| AI-agent lane separation | Cloudflare signed agents；HUMAN AI Agents；DataDome Agent Trust。citeturn33search3turn21view3turn13view1 | 内部保留 Lane B schema | 坚决不混到客户报表/URL/UTM/GA4 | 暂不对外售卖 AI-agent 产品 |
| Adversarial harness | BotD 可测 automation families；Sentry/rrweb/OTel 适合事件与回放回归。citeturn8view1turn24view0turn27search7turn30view2 | RECORD_ONLY shadow harness | 把“误判治理”前置到研发流程 | 暂不追求线上实时阻断闭环 |

## Helen 待决项与研究限制

### Open decision for Helen

1. **Sprint 2 是否允许引入服务端/边缘证据。** 没有它，Lane A 只能做到 observation-heavy 的验证建议，而非强验证。  
2. **是否在 v1 就保存 `tab_session_id` 与 refresh continuity。** 不做会显著削弱 refresh-loop 识别。  
3. **客户-facing 术语选型。** 建议避免 “human verified”“AI identified”“intent proven” 之类过强表述。  
4. **Lane B 是否 dark-launch。** 我建议保留 schema、隐藏输出。  
5. **RECORD_ONLY 持续多久。** 我的建议是至少一个完整销售/投放周期，直到 false-positive review 有稳定样本。  

### Open questions / limitations

本报告优先使用公开官方文档、公开产品页、帮助中心与公开仓库，因此对一些商业产品的**内部特征工程、模型结构、阈值细节、误判运营 SOP** 无法做强断言。尤其是 urlLunioturn19view4、urlCHEQturn19view2、部分 urlDataDometurn13view1 与 urlHUMAN Securityturn20search1 的公开资料更偏产品叙事而非实现细节，因此我在矩阵中已标出较低或中等信心，不把这些内容当成 BuyerRecon v1 的硬依赖。citeturn19view2turn19view4turn13view1turn21view1

另一个限制是 AI crawler / AI agent 的公开控制面仍在快速变化。当前最稳定、最可依赖的仍然是**公开声明 + 官方控制 token/验证机制**，例如 OpenAI crawler docs、Google-Extended、Cloudflare verified/signed agents；但像 Anthropic 这样的生态，公开运维细节仍较分散，因此 BuyerRecon 在 Lane B 上应坚持“声明优先、验证优先、行为推断降级”的保守路线。citeturn33search0turn36search0turn33search3turn35search3