# BuyerRecon Sprint 3 输出层深度研究报告

## 结论先行

BuyerRecon 在 Sprint 3 的核心问题，不是“再做一个更漂亮的 dashboard”，而是：**安装后第一屏如何在不夸大的前提下，让用户在 10 分钟内看懂“系统已连通、证据已出现、结论仍有边界”**。从公开资料看，网站访客识别类产品普遍把“首值”放在三件事上：**安装验证、实时活动、可行动对象**；行为分析/BI 类产品则更擅长把“首值”做成**模板、过滤、钻取、分享、订阅**。BuyerRecon 不应复制它们的“信号堆叠”，而应把这些模式重新组织成**证据优先、事实-推断-建议分层、可回滚**的输出层。citeturn9search6turn10view3turn13search1turn23search0turn32search4turn33search0turn36search0turn37view0turn42view0turn42view1

### 仪表盘的十条教训

1. 首屏要先证明“系统已工作”，再展示“系统认为你该做什么”。多数产品先给安装状态、实时计数或首个实时访客，而不是一上来就给复杂归因图。citeturn9search6turn10view3turn23search0turn32search4turn33search0  
2. 最有价值的首屏元素通常不是总览大图，而是**一个可钻取对象**：公司、会话、访客或录屏。citeturn8view1turn10view0turn17view1turn34view2turn37view1  
3. 高可用产品会把“聚合视图”直接连到“证据原文/原会话”。Hotjar 从 dashboard 点进 recording/heatmap，Matomo 从实时流点进单访问日志，PostHog 从 funnel 点到掉队用户与路径。citeturn34view0turn37view1turn35view3  
4. 好的 dashboard 不把所有图塞在首页，而是把首页当“分诊台”：实时、趋势、重点对象、下一步。citeturn10view0turn32search16turn36search0turn43search2  
5. 过滤器应当是一级交互，不应埋在二级菜单。Leadfeeder、Snitcher、Hotjar、HubSpot、Metabase 都把过滤/segment 当作组织复杂性的主手段。citeturn8view1turn25search9turn34view0turn38search12turn43search0  
6. 模板与自动生成能显著降低“空白画布焦虑”。PostHog 的模板与 AI starter prompts、Metabase 的 X-rays/自动生成 dashboard 都在解决这个问题。citeturn36search0turn42view0  
7. 首屏必须让用户知道“这是实时、近实时，还是已批处理的数据”。Leadinfo、Matomo、Clarity、GA4 都明确写出刷新/处理方式。citeturn10view1turn37view0turn32search4turn40view3  
8. “文本卡片/注释卡片”很重要。PostHog、HubSpot、Metabase 都允许在 dashboard 里加说明文字，这对 BuyerRecon 的 claim-safe 叙事非常关键。citeturn36search0turn38search5turn43search2  
9. 报告自动化不是附属功能，而是 dashboard 的第二出口。HubSpot、Metabase、Superset、Grafana、Looker Studio 都把“共享/订阅/定时发送”做成一级能力。citeturn38search0turn42view1turn3search3turn4search16turn5search1  
10. 客户可见 dashboard 与内部运营 dashboard 应该分裂，而不是用权限隐藏同一页面上的所有复杂项。市场上多数产品把内部调试、导出、路由、健康检查、权限与高级过滤放在不同层级。citeturn15search0turn23search0turn32search4turn43search6  

### 报告的十条教训

1. 报告最有效的顺序是：**发生了什么 → 为什么这可能重要 → 你能点开看什么 → 下一步建议**。citeturn20search1turn34view1turn42view1  
2. 好报告会包含**最小可验证证据**，而非只给总分。RB2B 的 CSV 字段、Leadfeeder 的 Activity tab、Matomo 的 Visits Log 都强调可回溯字段。citeturn18search1turn8view2turn37view1  
3. 报告应让“对象”稳定：某个 session、某家公司、某个时间段，而不是混合多个粒度。citeturn17view1turn8view2turn37view1  
4. 报告应允许“只发有结果的内容”。Metabase 明确支持“没有结果就不发送”，这是 BuyerRecon 低数据阶段的关键模式。citeturn42view1  
5. 报告需要有附件/导出，但导出的对象应是结构化字段而非截图优先。HubSpot、RB2B、Metabase、Grafana 都支持 CSV/Excel/PDF/调度，但侧重点不同。citeturn38search0turn18search1turn42view1turn4search16  
6. Founder-readable 报告要少图多证据，不要先给 12 个 KPI 再解释。Hotjar Highlights、Metabase X-rays、本质上都是把“具体异常/片段”编排给人看。citeturn34view1turn42view0  
7. 报告中的建议必须显式依赖证据门槛。Snitcher、Leadinfo、Lead Forensics 都把 alert/segment/trigger 建立在规则上，而不是纯黑盒分数。citeturn11search0turn25search8turn19search0  
8. 报告里要显示“遗漏与不可见性”。GA4 的 sampling/thresholds、Snitcher 的 Anonymous、RB2B 的验证/丢弃低质量匹配，都是在公开承认边界。citeturn41search1turn22view1turn17view2  
9. 报告语言要从“buyer intent confirmed”退回到“evidence consistent with buying research”。公开产品几乎都用“activity/intent signal/engagement”，而不是“buyer confirmed”。citeturn0search6turn22view0turn20search8  
10. 报告必须保留 drill-down，不然 founder 会在“为什么你这么说”这一问上失去信任。citeturn34view0turn35view3turn37view1  

### 首值体验的十条教训

1. 安装后 5–30 分钟内，用户应至少能看到**连通性证明**。Leadinfo、Leadfeeder、Snitcher、Clarity、Hotjar 都有类似模式。citeturn10view3turn9search6turn23search0turn32search4turn33search0  
2. 如果业务数据不会马上出现，产品必须明确写出来。Leadfeeder 提醒约 1 小时、Albacross 提醒可到 24 小时、Snitcher 提醒 20–30 分钟、Hotjar 说明低流量会延后。citeturn9search0turn13search1turn23search0turn34view2  
3. 零数据时，不要留白，要给出“下一步验证动作”。GA4 首页 banner、Hotjar verify installation、Clarity verify install 都是范例。citeturn40view4turn33search0turn32search4  
4. 薄数据时，不要假装有统计显著性，应切回对象级证据。citeturn17view1turn37view1turn34view3  
5. 首值最好与“你的网站刚刚发生了什么”有关，而非泛化“你的网站本周趋势”。citeturn10view0turn37view0turn32search4  
6. 首值要能一眼区分“平台已运行”与“平台已发现可疑/有价值对象”。RB2B 的 health check 与 profiles 分页、Snitcher 的 Connected/Disconnected 与 first data delay，是两个不同层。citeturn15search0turn23search0  
7. 首值体验最好包含一个“从量到质”的自然过渡：实时总览 → 首个对象 → 深入证据。citeturn10view0turn8view1turn17view1turn34view0  
8. 首值不应先要求用户自己搭 report。模板或自动生成比空白画布更强。citeturn36search0turn42view0  
9. 首值要能把“行为”和“身份/账户”分开看。Leadfeeder、RB2B、Snitcher 都在做会话/对象/账号不同粒度分离。citeturn8view1turn17view1turn22view1  
10. 首值文案必须承认“不是所有流量都能被识别”，否则后续会在 match rate 上失信。citeturn1search1turn22view1turn17view2  

### BuyerRecon 应避免的十件事

1. 把 evidence grade 当成“买家确定度”。  
2. 首屏堆 8 个图，却不给一条可点开的证据链。  
3. 在零数据时直接显示全空 dashboard，而不显示安装状态与下一步。  
4. 在低数据时给出强推荐动作，如“立即交给销售”。  
5. 将内部调参、匹配率、剔除规则、bot/proxy 细节直接暴露给客户。  
6. 让“事实、推断、建议”混在一句话里。  
7. 只给总分，不给组成项，不给限制项。  
8. 用红绿灯式强色彩制造虚假的确定性。  
9. 用“company detected”代替“session evidence captured + account inference”。  
10. 把 report automation 放到 v2，再让客户靠截图传播价值。以上问题都与公开产品中较成熟的安装验证、导出、自动报告、限制说明模式相反。citeturn23search0turn32search4turn33search0turn38search0turn42view1turn4search16  

## 市场与产品模式矩阵

### 识别类产品矩阵

| Product | First value after install | Empty state | Low-data state | Session/visitor view | Company/account view | Report/export pattern | Confidence/limitation display | CTA/action recommendation | Weakness/gap | Source | Confidence level |
|---|---|---|---|---|---|---|---|---|---|---|---|
| urlLeadfeeder / Dealfrontturn0search4 | 5–10 分钟可检查 tracker，约 1 小时后见新公司；首页可从 personalized home 进入 Web Visitors。 | 安装后会显示 Not installed / Not receiving data。 | 先用 feed、date filter、engagement score 排序，看“活跃公司”而非复杂分析。 | Activity 显示访问日期、停留时间、具体页面。 | Company Profile 把 firmographic、contacts、CRM、AI insights、signals 放在一处。 | 可加 CRM、加 List、邮件发送 visit details、跟踪未来访问。 | 有 engagement score，但更像排序分数，不是显式边界说明。 | Follow company、Add to CRM、Add to List。 | 强在公司画像，弱在“claim-safe 证据/限制表达”。 | urlHelp Centreturn8view0、urlWeb Visitors Basicsturn8view1、urlCompany Profileturn8view2、urlTracker installturn9search0、urlTracker checkturn9search6；citeturn8view1turn8view2turn9search0turn9search6 | 高 |
| urlLeadinfoturn0search5 | tracker live 后，首个公司出现即可进入 portal；dashboard 有 live、地图、活跃公司、热门页面。 | 安装页与帮助文档围绕“tracking code live?”、“等待 5–10 分钟”组织。 | dashboard 按 24h/7d/31d，低量时仍能看 live widget 和 active companies。 | 更偏公司访问与页面活动，不强调单 session 叙事。 | 公司列表、来源区域、公司规模、行业/branch 视角明显。 | 邮件报告支持 daily/weekly/bi-weekly/monthly，基于 segment/rules。 | Hidden Tag 明确说明：报告/仪表盘会保留，inbox 会隐藏。 | 调整营销定位、设置报告、推 CRM。 | 偏 lead inbox 与区域/行业概览，证据分层与不确定性表达较弱。 | urlDashboard explainedturn10view0、urlDashboard FAQturn10view1、urlInstall guideturn10view2、urlTracker checkturn10view3、urlEmail reportsturn11search0；citeturn10view0turn10view1turn10view2turn10view3turn11search0 | 高 |
| urlAlbacrossturn0search6 | 首值承诺是“Instant setup”，但 help 明确说 tracked companies 可能要到 24 小时后才出现在 Intent Dashboard。 | 空状态核心是“装脚本 + 等待 Intent Dashboard 出数”。 | 薄数据时仍以公司级 reveal、pages visited、ready-to-buy segmentation 为主。 | 没有公开展示强 session-card 结构。 | 强调 company name / website / address / size / employees/contacts。 | CSV 导出、API/Zapier/CRM 导出。 | 公开资料更偏“intent / likely to convert”，边界说明较少。 | Try now、push to CRM、AI segmentation。 | 公开资料偏营销页，具体空/低数据 UX 公开细节不足。 | urlProduct pageturn0search6、urlGain Insightturn0search10、urlGet started helpturn13search1、urlInstall helpturn13search2、urlExport helpturn14search0；citeturn0search10turn13search1turn13search2turn14search0 | 中高 |
| urlRB2Bturn17view2 | dashboard 内有 script/account health check；验证后进入 person/company profiles；近期更新还区分 person/company collection rates。 | 空状态以脚本验证、domain verification、健康检查为主。 | 薄数据时仍可先看 person/company pages、page count、repeat visitor、filtered export。 | 访客条目含姓名、头像、城市州、LinkedIn、title、email、last seen、page count。 | company-level 与 person-level 分页分开；CRM 里还能推 page view history。 | CSV 按日期范围导出，含 first/last seen、recent page URLs、tags、profile type。 | 明确写 validation & low-quality discard；也公开 person/company 适用范围与地理限制。 | Hot Leads、CRM sync、share profile。 | public docs 仍偏“reveal 能力”，外部 claim-safe 语言不够克制。 | urlWhat is RB2Bturn17view2、urlViewing visitorsturn17view1、urlCSV exportsturn18search1、urlInfo providedturn18search2、urlChangelogturn15search0；citeturn17view1turn17view2turn18search1turn18search2turn15search0 | 高 |
| urlLead Forensicsturn1search0 | 首值强调 real-time alerts、实时识别、portal 内 reports/export。 | 公开资料未找到明确空状态页面，更多是“try free / book demo”。 | 低数据阶段仍可依赖 ICP/watchlist selective alerts。 | 公开页强调 pages viewed、what they are looking at。 | 账户/目标名单与 key decision-maker data 是主叙事。 | portal 内 report/export；也可 daily/weekly/monthly mailbox reports；CRM integration。 | 更偏“high intent”“#1”营销表述，限制展示弱。 | real-time alerts、CRM、ABM target account alerts。 | 公开帮助细节不足，claim-safe 与边界说明薄。 | urlHomepageturn19search1、urlTechnical guideturn19search0、urlMarketing solution pageturn20search1、urlPricing FAQturn20search4；citeturn19search0turn20search1turn20search4 | 中 |
| urlSnitcherturn1search5 | dashboard 内 Verify/Installation；20–30 分钟看到 first data，然后实时更新；docs 明确 product flow。 | tracker Connected/Disconnected，很适合做安装空状态。 | 低数据时用 high-intent leads、segments、buyer personas、lead scoring 来聚焦。 | dashboard 可看 identified companies、sessions、user activity；无法识别时显示 Anonymous + approximate location。 | user identification 可把表单/登录后的历史会话归并到人/公司。 | 支持 CRM、Slack、webhooks、REST API；帮助中心公开 export/Looker Studio enrichment 模式。 | 明确区分 company ID 与 user ID，明确 ISP/VPN/mobile network 限制。 | Slack/email/CRM alerts，People tab 找联系人，按 persona/outreach。 | 强在可操作性；外部表达仍偏“intent to revenue”，需要 BuyerRecon 更克制。 | urlDocs overviewturn22view0、urlHow Snitcher Worksturn22view1、urlVerify trackerturn23search0、urlLead scoringturn25search8、urlTypes of segmentsturn25search9；citeturn22view0turn22view1turn23search0turn25search8turn25search9 | 高 |
| urlCANDDihttps://www.canddi.com | 首值围绕“see who’s visiting”“individual-level tracking”“real-time alerts”。 | 公开首页未展示安装空状态。 | 低数据时仍可依赖 individual/company reveal 与 campaign attribution。 | 强调 visitor-level tracking，能知道 person 而非只 company。 | 账户视角偏 CRM/inbox lead 流。 | leads 进 sales inbox 与 CRM；有 API 与 CMS/CRM integrations。 | 公开首页几乎不展示限制与误差边界。 | 实时 alert、CRM 路由、营销归因。 | 公开帮助/产品 tour 细节抓取不完整，研究置信度低于其他行。 | urlHomepagehttps://www.canddi.com；citeturn28view0 | 中低 |

### 分析、行为与报表类产品矩阵

| Product | First value after install | Empty state | Low-data state | Session/visitor view | Company/account view | Report/export pattern | Confidence/limitation display | CTA/action recommendation | Weakness/gap | Source | Confidence level |
|---|---|---|---|---|---|---|---|---|---|---|---|
| urlMicrosoft Clarityturn1search19 | 安装后可立刻看到 live users / Watch now；dashboard 和 recordings 数据可即时进入。 | Verify installation 两种方式；无数据时先做安装校验。 | 用 recordings/heatmaps/dashboard filters 继续探索。 | session recordings 是主证据单位。 | 无 account-based view。 | share link / email；可对外分享 recording/heatmap。 | 明示 Canvas/第三方 iframe 等兼容限制。 | Watch now、看 recordings/heatmaps。 | 对 BuyerRecon 来说，行为证据强，B2B account 语义弱。 | urlDocs hometurn32search0、urlSetup/verifyturn32search4、urlDashboard featuresturn32search16、urlShareturn32search17；citeturn32search4turn32search16turn32search17 | 高 |
| urlPostHogturn2search15 | Next steps 直接建议：加网站数据、看第一个 session replay、用 web analytics dashboard。 | Blank dashboard 有 AI starter prompts，减少空白画布。 | 用 templates、filters、text cards、button tiles 组织薄数据。 | funnels 可 drill 到 completed/dropped users 与 paths；session replay 明确是分析一等公民。 | 可做 group/account 过滤，但需相应 analytics 能力。 | share/public/embed、auto refresh、AI refresh analysis、Terraform export。 | 对 dashboard 本身限制说明较完整；更偏产品分析，不是 buyer-proof。 | 从 insights 走向 dashboard，再走向 pipeline/export。 | 功能强但复杂；若直接照搬会让 BuyerRecon 首屏过重。 | urlNext stepsturn35view1、urlDashboards docsturn36search0、urlFunnels docsturn35view3；citeturn35view1turn36search0turn35view3 | 高 |
| urlMatomoturn37view2 | 首值是实时访客流、24h/30min 计数、实时地图。 | 没有“空白画布”感，更多是先看实时 widget。 | 低量网站也能用实时地图/实时流检查 tracking accuracy。 | Visits Log 能看单个 visit/session 的动作链。 | 无原生 B2B company card，但有 location/org 维度。 | widget 化、embed、custom dashboards。 | 明确匿名用户看不到 visitor IP/ID。 | 从实时流进入单访客日志与 goal 检查。 | 强于可追溯 session，弱于 B2B 销售信号语言。 | urlReal-time reportturn37view0、urlVisits logturn37view1、urlFeaturesturn37view2、urlReal-time mapturn37view3；citeturn37view0turn37view1turn37view2turn37view3 | 高 |
| urlHotjarturn2search17 | 安装后 recordings 自动开始；dashboard 可从聚合指标点进 recording/heatmap/survey。 | 有明确的 Not installed / No data received / Collecting data 状态与 verify flow。 | 低流量会延后数据；heatmap 无数据时会明确提示检查 URL 是否有 recordings。 | recording 与 highlight snippet 是核心证据对象。 | 无 account-based company view。 | dashboard widgets + heatmap JPG/CSV + highlights PNG/MP4 + share links。 | 明确 low/inconsistent traffic、no data、page not tracked 等限制。 | 从 dashboard → recording/heatmap/highlight collection。 | 对 BuyerRecon 来说极适合“证据卡/片段化分享”，但缺公司证据层。 | urlVerify trackingturn33search0、urlSet up recordingsturn34view2、urlSet up heatmapsturn34view3、urlDashboardsturn34view0、urlHighlightsturn34view1；citeturn33search0turn34view0turn34view1turn34view2turn34view3 | 高 |
| urlHubSpot Reportingturn38search1 | 首值通常来自 dashboard library / custom report builder，而不是实时检测。 | 空状态靠 create dashboard、report library、add content。 | 薄数据阶段也能靠 filters、quick filters、文本块保持 dashboard 可读。 | 有 drill-down 报告但不是 session replay 式。 | 能跨对象做 target account engagement/reporting。 | email、Slack、Google Chat 递送；CSV/Excel 导出；recurring schedules。 | 权限、订阅层级与 capture time 说明明确。 | save to dashboard、share via channel、schedule email。 | 更擅长运营报表，不擅长证据级链路表达。 | urlCustom reportsturn3search12、urlManage dashboardsturn3search4、urlCustomize dashboardturn38search5、urlShare/exportturn38search0；citeturn3search12turn3search4turn38search5turn38search0 | 高 |
| urlGA4 Explorations / Reportsturn39search0 | 首值来自 Home + Realtime；无数据时首页 banner 直接提示创建 stream / set up data collection。 | 空状态处理是 GA4 的强项之一：先教你接线，不假装已有洞见。 | 薄数据时仍可用 Realtime、Home cards、overview reports；高阶再进 Explore。 | path exploration / pages & screens 支持行为路径。 | 无 B2B account view。 | report 可导出 PDF/CSV/Sheets； exploration 可导出 Sheets/TSV/CSV/PDF。 | 明确 sampling、thresholds、reports vs explorations differences。 | 从 Home/Realtime 走向 Reports/Explore。 | 对 BuyerRecon 的启发更多在“no-data honesty”而不是 buyer-motion。 | urlHome pageturn40view4、urlExplorationsturn40view0、urlExplore playbookturn40view1、urlData differencesturn40view2、urlTroubleshoot setupturn40view3、urlShare/exportturn41search0；citeturn40view0turn40view1turn40view2turn40view3turn40view4turn41search0 | 高 |
| urlLooker Studioturn5search5 | 首值不在安装验证，而在快速搭可共享 report。 | blank report + gallery 是空状态替代方案。 | 薄数据时仍可用多页 report、controls、text 区块构造“解释性版面”。 | 偏汇总图表，不是 session-level。 | 无原生 account evidence card。 | schedule email delivery、publish draft vs live、share/view-only。 | 发布/共享边界清晰，但对数据限制提示不如 GA4。 | share、schedule、embed。 | 适合作为 report layout 参考，不适合作为证据系统核心。 | urlReport docsturn5search1、urlData Studio docsturn5search5、urlReport publishingturn5search15、urlReport Galleryturn5search13；citeturn5search1turn5search5turn5search15turn5search13 | 中高 |

## 开源与相邻产品模式矩阵

| Project | Relevant pattern | Query/report structure | Dashboard IA | Export/reporting capability | BuyerRecon applicability | Risk/complexity |
|---|---|---|---|---|---|---|
| urlMetabase Docsturn3search10 | X-rays 自动生成 insight；新接入数据源时给自动探索；questions 是最小分析单元。 | Question（查询/图）→ Dashboard → Subscription。 | tabs + questions + text/header/link cards；filters 可作用于全局/分节/单卡。 | email/Slack subscriptions；可测试发送；可“无结果不发送”。 | **非常适合 BuyerRecon 的 first-value dashboard、founder-readable report、empty/low-data 邮件策略。** | 低到中；概念与 BuyerRecon 的 evidence object 很兼容。 citeturn42view0turn42view1turn42view2turn43search0turn43search2 |
| urlApache Superset Docsturn3search7 | chart→dashboard 的经典 BI 流水线；alerts & reports 可定时发送。 | dataset / chart / dashboard / alerts-reports。 | 偏分析师工作台，适合内部运营监控与 QA 控制台。 | email/Slack reports；API 可导出 dashboard YAML example bundle。 | **更适合内部 dashboard，不适合 BuyerRecon 客户首屏。** | 中到高；配置、权限、渲染与渲染器依赖更重。 citeturn3search3turn3search11turn3search19 |
| urlGrafana Docsturn4search6 | 多数据源统一 dashboard；image rendering；带图报警通知。 | panel / dashboard / alert / report。 | 很适合内部运行态、健康检查、数据管道告警。 | PNG/PDF/CSV、scheduled emails、alert images。 | **最适合 BuyerRecon internal ops dashboard 与 runtime proof 面板。** | 中；对客户侧 narrative reporting 不够友好。 citeturn4search4turn4search16turn4search2turn4search8turn4search19 |
| urlMatomo Docsturn37view2 | 实时流 + 访问日志 + widget 化 + privacy note。 | 实时 widget / visits log / custom dashboard。 | 先概览再单访问；对象钻取路径清晰。 | widget/embed；demo 可公开查看。 | **可直接借鉴 session evidence card 与 buyer-motion timeline 的“动作序列”呈现。** | 低到中；B2B account layer 需要 BuyerRecon 自补。 citeturn37view0turn37view1turn37view3 |
| urlPostHog Docsturn2search15 | Blank dashboard AI starter prompts；templates；文本卡；自动分析刷新结果。 | insight / funnel / replay / dashboard / template。 | 首屏支持模板与空状态导航，适合复杂产品分析。 | public/embed、auto refresh、Terraform export。 | **可借鉴 first-value 空状态、text card、内部模板管理。** | 中；过于强大，V1 容易“BI 化过度”。 citeturn35view1turn36search0turn35view3 |
| urlLooker Studio Docsturn5search5 | 多页 report、控件、发布草稿与正式版、gallery。 | report → pages → components/controls。 | 适合“面向外部阅读”的报告版式。 | share、publish、schedule email。 | **适合 BuyerRecon 自动报告模板与外部 PDF/邮件布局参考。** | 低；但交互证据链与 account/session drill-down 需另做。 citeturn5search1turn5search5turn5search15turn5search13 |

**综合判断：** BuyerRecon 的 v1 最应该借的是 **Metabase 的“最小分析单元 + 自动 dashboard + 订阅判断”**、**Hotjar 的“证据片段化分享”**、**Matomo 的“对象级访问日志”**、**GA4 的“空状态诚实度”**，以及 **Grafana 的“内部运行与健康证明”**。不应该借的是传统 BI 首屏堆图、或 visitor-ID 产品常见的“高意向即高确定”的外部话术。citeturn42view0turn42view1turn34view1turn37view1turn40view4turn4search16

## BuyerRecon 推荐信息架构

下表按你要求的输出纪律，分为 **Fact / Inference / Recommendation / Open decision for Helen**。其中 Fact 来自公开产品模式；Inference 是跨产品推断；Recommendation 是 BuyerRecon v1 建议；Open decision 是必须由 Helen 拍板的地方。

| 模块 | Fact | Inference | Recommendation | Open decision for Helen |
|---|---|---|---|---|
| first-value screen | 市场上首值通常先验证安装、再显示实时/首个对象，而不是先给复杂 dashboard。citeturn9search6turn23search0turn32search4turn33search0 | BuyerRecon 若首屏没有“系统已连通 + 首条证据”，用户会把它当成尚未生效的脚本。 | 首屏只放 4 块：**安装状态、过去 30 分钟活动计数、首个证据卡、系统边界说明**。默认不显示总评分。 | 首屏默认是“单域名视角”还是“workspace 视角”？ |
| empty-state report | GA4、Hotjar、Clarity、Snitcher 都在零数据时把重心放在安装检查和下一步。citeturn40view4turn33search0turn32search4turn23search0 | BuyerRecon 零数据时最重要的是建立信任，而不是制造“空”。 | 空状态文案：**“BuyerRecon 已连接，正在等待首个可验证会话。当前可确认：脚本已运行、域名规则已生效、数据管道正常。尚无足够证据判断是否存在买方动向。”** | 是否在空状态显示埋点/域名/同意状态的技术细节给客户？我建议默认不显示，只给“查看技术状态”链接。 |
| low-data-state report | Hotjar 与 GA4 都明确区分“有 tracking、但数据不足”。citeturn34view2turn34view3turn40view3 | 低数据阶段应该从统计图退回到“观察到的对象与动作”。 | 低数据文案：**“已捕获早期活动，但证据仍不足以下强结论。以下内容仅代表已观察到的会话与页面行为，不代表已验证买方身份或购买意图。”** | 薄数据阈值是按 sessions 还是按 evidence atoms 计算？ |
| first 24-hour report | Leadinfo、Albacross、Snitcher、Leadfeeder 都把前 24h 作为“开始看到公司/活动”的自然窗口。citeturn10view0turn13search1turn23search0turn9search0 | BuyerRecon 的第一份自动报告应是“建立心理模型”，不是“做周报”。 | 24h 报告结构：**系统状态 → 观察到的活动量 → 最强一条 session 证据 → 最强一条 account 证据 → buyer-motion timeline 初版 → 当前不能说什么 → 建议下一步。** | 24h 报告默认发给谁：安装者、workspace owner、全部 team，还是可选？ |
| session evidence card | Matomo、Hotjar、Clarity 都把单次访问/录屏做成核心证据对象。citeturn37view1turn34view2turn32search16 | BuyerRecon 最能建立信任的不是 aggregate KPI，而是“这一次会话到底发生了什么”。 | 卡片字段：**Session ID、首次/最近时间、referrer/UTM、页面序列、停留/返回、关键页命中、表单/CTA 事件、limitation note**。底部强制分三块：**事实 / 推断 / 建议**。 | 是否在客户侧显示原始 URL 全路径与 query 参数？ |
| company/account evidence card | Leadfeeder、Leadinfo、RB2B、Snitcher 都把 company/account 作为 B2B 行动的主对象。citeturn8view2turn10view0turn17view1turn22view0 | BuyerRecon 应把“公司层”当成证据聚合层，而不是确定身份层。 | 卡片字段：**Company/Account label、证据来源数、相关 sessions、涉及页面主题、最近一次出现时间、重复来访、来源分布、CRM existence、limitation note**。标题不要写“Identified buyer”，只写“Observed account pattern”。 | 公司 label 是否允许“Unknown / probable account / verified account”三级？ |
| buyer-motion timeline | Matomo Visits Log、Snitcher cross-session history、Leadfeeder Activity tab、RB2B page view history 都强调时间序列。citeturn37view1turn22view1turn8view2turn18search5 | 时间线比雷达图更适合 founder-readable。 | 时间线按事件组展现：**首次触达 → 再次回访 → 高意图页查看 → 关键切换（pricing/docs/integration/security） → 最近一次活动**。每个节点都带 raw evidence count。 | timeline 是按 session 还是按 account 聚合为默认视图？我建议默认 account，可切回 session。 |
| evidence-grade display | 市场普遍有 score/intent/engagement，但很少把“这只是证据置信度，不是购买确定度”讲清楚。citeturn8view1turn10view0turn25search8turn17view2 | BuyerRecon 可以反其道而行，把 grade 定义成**证据完备度**。 | 使用 **E0–E4**：E0 无足够证据；E1 仅安装/稀薄流量；E2 单会话证据；E3 重复访问或多证据线一致；E4 多会话 + 账户聚合 + 关键动作一致。旁注固定写：**“证据等级衡量的是已观察证据的完备度，不代表购买概率。”** | 用字母 E0-E4，还是中文“低/中/高”？我建议 E0-E4，更中性。 |
| safe-claim report wording | Snitcher、RB2B、GA4 都公开承认匿名、抽样、阈值或验证边界。citeturn22view1turn17view2turn41search1 | BuyerRecon 的差异点可以正是“我们不把推断说成事实”。 | 规则：只允许用 **observed / indicates / consistent with / suggests / insufficient evidence / not yet verified** 对应中文：**已观察到 / 与…一致 / 提示 / 可能 / 证据不足 / 尚未验证**。禁止：**definitely buyer / confirmed buyer / guaranteed intent / high-converting lead**。 | 是否在所有报告底部加入统一免责声明？我建议加，且固定不可删。 |
| internal vs external dashboard split | RB2B 有 health check、plan usage、integration logs；Grafana/Superset 更适合内部监控；客户侧产品很少暴露全部匹配细节。citeturn15search0turn18search6turn4search16turn3search3 | BuyerRecon 若不拆层，外部会过重、内部会缺诊断。 | **External**：first-value、evidence cards、timeline、safe report、report subscriptions。 **Internal**：match pipeline、bot/proxy flags、domain/cookie/consent status、resolver diagnostics、suppression reasons、heuristic weights、false-positive audit、render logs。 | 哪些 calibration knobs 完全不外露？我建议：解析器权重、bot rules、suppression 阈值、identity confidence 分解、raw enrichment provenance。 |
| report template | Looker Studio、HubSpot、Metabase 都支持多页/订阅/说明文本。citeturn5search1turn38search0turn42view1 | BuyerRecon 报告应该是 narrative-first，而不是 BI-first。 | 模板页顺序：**封面摘要 → 本期观察到的买方动向 → strongest session → strongest account → timeline → 当前限制 → 建议动作 → 方法说明**。 | 报告默认是邮件正文型、网页型还是 PDF 型？我建议网页型为主，邮件为摘要，PDF 后补。 |

### BuyerRecon v1 外部 dashboard 结构

建议外部客户侧采用以下 6 区块，避免首页太像 GA4/BI 产品：  
**系统状态**、**首值证据**、**会话证据**、**账户证据**、**买方动向时间线**、**自动报告入口**。每一块都必须带一条限制说明，且至少一个可钻取对象。这样既像 Leadfeeder/RB2B 这类 B2B 产品那样有行动对象，又像 Hotjar/Matomo 那样保留原始证据链。citeturn8view2turn17view1turn34view1turn37view1

### BuyerRecon v1 内部 dashboard 结构

内部只给运营、研发、校准人员看，建议 7 区块：  
**tracker/consent health**、**ingestion latency**、**session-to-account resolver**、**bot/proxy suppression**、**evidence-grade distribution**、**false-positive review queue**、**report render/send status**。这部分更像 Grafana + Superset + RB2B health check 的合体，而不是客户看的“故事页”。citeturn15search0turn4search4turn4search19turn3search3

## 研究到交付物映射

### build contract

BuyerRecon 的后端与输出层建议通过五类结构化对象对接：  
**EvidenceAtom**（最小事实）、**SessionEvidenceCard**、**AccountEvidenceCard**、**MotionTimelineNode**、**ClaimBlock**。其中 ClaimBlock 必须显式区分 `facts[]`、`inferences[]`、`recommendations[]`、`limitations[]`，否则前端很容易把推断混入事实。这个结构同时吸收了 Metabase 的 question/card 思路、Hotjar 的 highlight/collection 思路和 Matomo 的 visit log 思路。citeturn42view2turn34view1turn37view1

一个可执行的 v1 contract 可以是：

- `installation_status`: `not_installed | connected_no_data | collecting | verified`
- `evidence_grade`: `E0..E4`
- `session_card`: 时间、来源、页面序列、关键动作、raw count、limitations
- `account_card`: label、关联 session 数、相关主题页、repeat pattern、limitations
- `timeline`: 有序节点数组，每个节点都能回链到 evidence atoms
- `safe_claims`: UI 允许显示的句子模板 ID，而不是让前端自由拼文案

### test plan

测试计划应覆盖四种状态，而不是只测“有数据”：

1. **空状态**：脚本未装、脚本已装但未采到、采到事件但无可验证 evidence。  
2. **低数据状态**：只有 1 个 session；只有 1 个 account-like match；只有高意图页但无重复访问。  
3. **正常状态**：多 session、多 page group、多时间点，有 account 聚合。  
4. **冲突状态**：行为像 buyer research，但 identity 证据弱；identity 强，但行为弱；bot/proxy 抑制命中。  

每个状态都要验证：  
- 首屏文案是否过度承诺  
- 事实/推断/建议是否被正确分栏  
- report automation 是否在“无结果不发送”时正确跳过  
- 时间线节点是否都能回链到 raw evidence  
- evidence grade 是否只随证据完备度变化，不因文案变化而变化。以上测试设计明显借鉴了 GA4/Hotjar 的 no-data honesty、Metabase 的 send-if-results、RB2B/Snitcher 的 install verification。citeturn41search1turn33search0turn42view1turn23search0turn15search0

### runtime proof

BuyerRecon 的 runtime proof 不应只证明“埋点发了”，而要证明“客户可见输出为什么可信”。建议强制保留五条运行证明：

- **Connected proof**：tracker/consent/domain 已连接  
- **Data proof**：最近 N 分钟有事件进入  
- **Evidence proof**：首个 evidence atom 已生成  
- **Narrative proof**：session/account/timeline 三层对象均可回链  
- **Delivery proof**：report 已生成、已发送、快照版本可复现  

Grafana 的 reporting/image rendering、RB2B 的 health check、Snitcher/Clarity/Hotjar 的 verify installation 都说明：**系统健康证明**本身就是输出层可信度的一部分。citeturn4search2turn4search16turn15search0turn23search0turn32search4turn33search0

### Codex review checklist

如果 Sprint 3 里有大量 AI/Codex 辅助实现，代码 review 清单应强制包含：

- 每个 customer-facing card 是否有 `limitations` 字段  
- 是否将 `fact` 与 `inference` 混写到同一字符串  
- evidence grade 是否由确定规则计算，而不是由文案层覆盖  
- 当 grade < E2 时，是否仍会触发强销售 CTA  
- 页面是否支持空状态、低数据状态、正常状态三套快照  
- 导出与发送前是否保留 structured payload 与 rendered snapshot  
- 是否存在“客户可见但无法 drill-down 的结论”  
- 是否存在把内部调参参数暴露到外部 API 的风险  
- 是否支持 feature flag 关闭 recommendations / grades / account cards  
- 是否有 send-if-no-results 防护、重复发送防护、错误回退。这个 checklist 本质上把公开产品里的安装验证、订阅控制、对象级可追溯性前置到开发流程。citeturn42view1turn34view1turn37view1turn36search0

### rollback path

BuyerRecon 的 rollback 必须是**功能级回退**，不是整页下线。建议至少有四个 flag：

- `show_evidence_grade`
- `show_recommendations`
- `show_account_inference`
- `auto_send_reports`

当任何一项引发误报或话术风险时，可回落到**Observed activity only** 模式：只展示安装状态、会话事实、时间线事实，不显示 grade、不显示建议、不自动发报告。这个思路与 PostHog 的模板/卡片组合、Metabase 的 subscriptions 控制、Grafana 的 reporting 开关、RB2B 的 feature toggles 非常一致。citeturn36search0turn42view1turn15search0turn4search16

## 学习路径与最终基准

### 学习路径

**dashboard information architecture**  
先看 urlPostHog Dashboards docsturn36search0、urlMetabase dashboard introductionturn43search2、urlHubSpot dashboard customizationturn38search5，重点学习空状态、模板、文字卡、过滤器位置。citeturn36search0turn43search2turn38search5

**evidence visualization**  
优先看 urlHotjar Highlightsturn34view1、urlMatomo Visits Logturn37view1、urlMicrosoft Clarity dashboard featuresturn32search16。重点不是“图做多炫”，而是“证据片段如何被保存、分享、回看”。citeturn34view1turn37view1turn32search16

**report automation**  
优先看 urlMetabase subscriptionsturn42view1、urlHubSpot share/exportturn38search0、urlSuperset alerts & reportsturn3search3、urlGrafana reportingturn4search16。重点学习“何时发、发给谁、无结果是否跳过、如何测试发送”。citeturn42view1turn38search0turn3search3turn4search16

**low-data UX**  
优先看 urlGA4 Home pageturn40view4、urlGA4 setup troubleshootingturn40view3、urlHotjar verify trackingturn33search0、urlSnitcher verify trackerturn23search0、urlClarity setup & verifyturn32search4。citeturn40view3turn40view4turn33search0turn23search0turn32search4

**data storytelling**  
优先看 urlLooker Studio report docsturn5search1、urlLooker Studio report publishingturn5search15、urlGA4 summary card docsturn41search6。重点学习“信息排序”和“发布草稿 vs 正式版”。citeturn5search1turn5search15turn41search6

**B2B sales intelligence UX**  
优先看 urlLeadfeeder Company Profileturn8view2、urlLeadinfo dashboardturn10view0、urlSnitcher buyer personas / lead scoringturn25search3。重点学习从 account 到 contact 的承接，而不是直接抄 visitor-ID 文案。citeturn8view2turn10view0turn25search3turn25search8

**claim-safe copywriting**  
优先看 urlRB2B how it worksturn17view2、urlSnitcher how it worksturn22view1、urlGA4 data differencesturn40view2。重点学习公开承认限制、采样、匿名与验证边界。citeturn17view2turn22view1turn40view2

**internal BI design**  
优先看 urlGrafana dashboards/docsturn4search4、urlGrafana alertingturn4search19、urlSuperset docs/APIturn3search7。重点学习内部运行/健康/错误面板，而非客户叙事。citeturn4search4turn4search19turn3search7turn3search11

### 最终基准

| Module | Market benchmark | BuyerRecon v1 minimum | Evidence-grade improvement | Not-now / defer |
|---|---|---|---|---|
| first-value dashboard | 安装验证 + 实时/首对象 + 快速钻取 | 安装状态、30 分钟活动、首个证据卡、边界说明 | 从“脚本工作”升级到“证据出现且可回链” | 多图 overview 墙 |
| empty-state report | 明确 no-data、给 verify step | 自动生成空状态网页/邮件摘要 | E0 明示“无足够证据” | 空白页面或假数据 demo |
| low-data-state report | 承认数据薄、退回对象层视图 | 一条 strongest session + limitation + next step | E1/E2 与建议强度绑定 | 薄数据也给高意向标签 |
| first 24-hour report | 24h 内给 earliest insight | 自动发第一份 narrative report | E0→E2 的过渡可视化 | 周报/月报优先 |
| session evidence card | Hotjar/Matomo/Clarity 式对象证据 | 页面序列、来源、关键动作、限制说明 | 每条结论都有 session 回链 | 无法 drill-down 的聚合卡 |
| company/account evidence card | Leadfeeder/RB2B/Snitcher 式账户聚合 | observed account pattern + related sessions | 把“账户聚合”与“身份确定”拆开 | 直接写 confirmed buyer |
| buyer-motion timeline | visit log / activity history / cross-session history | account 默认时间线，可切 session | grade 随证据节点增量提升 | 桑基图/复杂路径图 |
| evidence-grade display | 市场多为 score/intention，但边界弱 | E0–E4 + 固定免责声明 | 证据完备度替代意向确定度 | 红绿灯式 hard judgement |
| safe-claim wording | 多数产品边界表述不足 | 模板化 safe phrases + banned phrases | recommendation 只能引用 facts/inferences | 自由发挥的营销文案 |
| report automation | email/Slack/PDF/CSV/skip-if-no-results | 网页报告 + 邮件摘要 + 手动/定时发送 | 发送前附带 snapshot/version/proof | 一开始就做复杂 PDF 排版 |
| internal vs external split | 内外分层成熟 | 客户侧故事页；内部侧健康/校准页 | 内部可看 grade 组成与 suppressions；外部不可见 | 单页靠权限隐藏全部 |
| rollback path | feature flags / health checks 常见 | 四个 flags：grade、recommendations、account inference、auto-send | 失败时降级为 observed activity only | 整个输出层一起下线 |

### Open questions / limitations

本研究尽量只使用公开产品页、帮助中心、官方文档与合法可访问资料。整体上，**Leadfeeder/Leadinfo/RB2B/Snitcher/Clarity/Hotjar/GA4/PostHog/Matomo/Metabase/HubSpot** 的公开资料足以支撑高置信结论；**Lead Forensics** 与 **CANDDi** 的 dashboard 公开细节更偏营销页或需要 demo/登录后体验，因此关于它们的空状态、低数据状态、细粒度卡片结构，本报告刻意降低了置信度并未做强推断。citeturn20search1turn28view0

最终建议可以压缩成一句话：**BuyerRecon 的 Sprint 3 不该做“另一个 analytics home”，而该做“一个能在 10 分钟内证明系统已工作、在 24 小时内给出第一条可回链买方动向证据、并且全程不越界用词的 evidence-first output layer”。** citeturn23search0turn32search4turn33search0turn42view1turn36search0