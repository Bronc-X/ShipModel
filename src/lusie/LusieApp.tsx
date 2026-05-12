import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  HelpCircle,
  Home,
  Info,
  LifeBuoy,
  Mail,
  MapPin,
  Menu,
  Newspaper,
  Phone,
  Plane,
  PlayCircle,
  QrCode,
  Rocket,
  Search,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type CompetitionStatus = "open" | "running" | "upcoming" | "completed";
type CompetitionCategory = "aero" | "drone" | "space" | "youth" | "mixed";
type ArticleCategory = "notice" | "news" | "score" | "download" | "recap";
type DownloadType = "rules" | "guide" | "score" | "manual" | "brand";
type FAQTopic = "account" | "registration" | "upload" | "review" | "score" | "certificate" | "institution";
type PolicyKind = "privacy" | "terms" | "anti-fraud" | "organization" | "brand";

interface RouteState {
  pathname: string;
  search: string;
}

interface Competition {
  id: string;
  title: string;
  category: CompetitionCategory;
  groups: string[];
  status: CompetitionStatus;
  startAt: string;
  endAt: string;
  deadline?: string;
  location: string;
  organizer: string;
  summary: string;
  imageUrl: string;
  registrationUrl: string;
  rulesUrl: string;
  resultUrl: string;
  certificateUrl: string;
  schedule: Array<{ time: string; title: string; detail: string }>;
  documents: Array<{ title: string; type: string; url: string }>;
  results: Array<{ rank: number; name: string; team: string; project: string; score: string }>;
}

interface Article {
  id: string;
  title: string;
  category: ArticleCategory;
  publishedAt: string;
  source: string;
  summary: string;
  coverUrl?: string;
  attachment?: string;
  sections: Array<{ title: string; body: string }>;
}

interface DownloadResource {
  id: string;
  title: string;
  competition: string;
  type: DownloadType;
  uploadedAt: string;
  fileType: "PDF" | "DOCX" | "XLSX" | "ZIP";
  size: string;
  url: string;
}

interface FAQItem {
  id: string;
  topic: FAQTopic;
  question: string;
  answer: string;
}

const NavigateContext = createContext<(to: string) => void>(() => undefined);

const legacyUrls = {
  login: "/index/common/login.html",
  participantRegister: "/index/common/registerM40",
  memberRegister: "/user/User/apply_register.html?type=1",
  institutionLogin: "/merchants/index/login/ft/cp",
  certificate: "/index/Schedule/detail.html?id=certificate"
};

const images = {
  hero:
    "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1600&q=82",
  drone:
    "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1000&q=82",
  aircraft:
    "https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=1000&q=82",
  runway:
    "https://images.unsplash.com/photo-1506947411487-a56738267384?auto=format&fit=crop&w=1000&q=82",
  classroom:
    "https://images.unsplash.com/photo-1581092918484-8313f0870c7d?auto=format&fit=crop&w=1000&q=82"
};

const statusMeta: Record<CompetitionStatus, { label: string; tone: string; action: string }> = {
  open: { label: "报名中", tone: "blue", action: "去报名" },
  running: { label: "比赛中", tone: "red", action: "看实时成绩" },
  upcoming: { label: "即将开始", tone: "neutral", action: "查看赛程" },
  completed: { label: "已完赛", tone: "muted", action: "看最终成绩" }
};

const categoryLabels: Record<CompetitionCategory, string> = {
  aero: "固定翼 / 航空模型",
  drone: "多旋翼 / 无人机",
  space: "航天模型",
  youth: "青少年赛事",
  mixed: "综合赛事"
};

const articleCategoryLabels: Record<ArticleCategory, string> = {
  notice: "官方通知",
  news: "赛事资讯",
  score: "成绩公示",
  download: "资料下载",
  recap: "媒体回顾"
};

const downloadTypeLabels: Record<DownloadType, string> = {
  rules: "竞赛规则",
  guide: "报名指南",
  score: "成绩公示",
  manual: "操作手册",
  brand: "宣传资料"
};

const faqTopicLabels: Record<FAQTopic, string> = {
  account: "账号",
  registration: "报名",
  upload: "上传",
  review: "审核",
  score: "成绩",
  certificate: "证书",
  institution: "机构"
};

const competitions: Competition[] = [
  {
    id: "nanjing-open-2026",
    title: "2026 全国航空模型公开赛（南京站）",
    category: "aero",
    groups: ["F3A", "F5J", "公开组", "青少年组"],
    status: "open",
    startAt: "2026-07-12",
    endAt: "2026-07-16",
    deadline: "2026-06-20 23:59",
    location: "南京市建邺区青奥航空运动场",
    organizer: "中国航空运动协会 / 南京市体育局",
    summary: "面向航空模型运动员和青少年队伍，集中发布报名、规程、赛程和成绩入口。",
    imageUrl: images.hero,
    registrationUrl: "/index/Schedule/detail.html?id=260712",
    rulesUrl: "/downloads/rules-nanjing-open-2026.pdf",
    resultUrl: "/news/results-nanjing-preview",
    certificateUrl: legacyUrls.certificate,
    schedule: [
      { time: "07月12日 09:00", title: "报到与器材检录", detail: "参赛队伍完成证件核验、设备安全检查和试飞确认。" },
      { time: "07月13日 08:30", title: "开幕式与资格赛", detail: "F3A、F5J 项目分组进行资格赛。" },
      { time: "07月15日 14:00", title: "决赛轮次", detail: "各项目排名前列选手进入决赛。" },
      { time: "07月16日 10:00", title: "成绩确认与颁奖", detail: "公示最终成绩并开放证书下载交接。" }
    ],
    documents: [
      { title: "南京站竞赛规程.pdf", type: "PDF", url: "/downloads/rules-nanjing-open-2026.pdf" },
      { title: "F3A 项目动作表.pdf", type: "PDF", url: "/downloads/f3a-actions.pdf" },
      { title: "参赛队报到材料清单.docx", type: "DOCX", url: "/downloads/checklist-nanjing.docx" }
    ],
    results: [
      { rank: 1, name: "张明远", team: "江苏省航空运动协会", project: "F3A 特技", score: "98.5" },
      { rank: 2, name: "陈予安", team: "浙江代表队", project: "F3A 特技", score: "96.2" },
      { rank: 3, name: "林嘉航", team: "上海航模俱乐部", project: "F3A 特技", score: "95.8" }
    ]
  },
  {
    id: "shanghai-drone-2026",
    title: "2026 中国无人机竞速公开赛（上海站）",
    category: "drone",
    groups: ["F9U", "专业组", "校园组"],
    status: "running",
    startAt: "2026-05-10",
    endAt: "2026-05-13",
    location: "上海市青浦区无人机飞行基地",
    organizer: "上海市航空运动协会",
    summary: "面向多旋翼竞速飞手，实时同步赛道公告、轮次安排和成绩公示。",
    imageUrl: images.drone,
    registrationUrl: "/index/Schedule/detail.html?id=260510",
    rulesUrl: "/downloads/drone-open-shanghai-rules.pdf",
    resultUrl: "/news/shanghai-drone-live-results",
    certificateUrl: legacyUrls.certificate,
    schedule: [
      { time: "05月10日 08:00", title: "赛道熟悉", detail: "飞手完成设备登记和赛道适应。" },
      { time: "05月11日 09:00", title: "预赛轮次", detail: "所有组别进行计时排位。" },
      { time: "05月13日 15:00", title: "总决赛", detail: "专业组与校园组决赛。" }
    ],
    documents: [
      { title: "上海站赛道图.pdf", type: "PDF", url: "/downloads/shanghai-track.pdf" },
      { title: "无人机竞速技术检查表.xlsx", type: "XLSX", url: "/downloads/drone-check.xlsx" }
    ],
    results: [
      { rank: 1, name: "韩奕辰", team: "星河竞速队", project: "F9U 专业组", score: "72.41s" },
      { rank: 2, name: "周洛", team: "华东飞行队", project: "F9U 专业组", score: "73.05s" },
      { rank: 3, name: "唐一诺", team: "青浦航模中心", project: "校园组", score: "81.22s" }
    ]
  },
  {
    id: "youth-aero-2026",
    title: "2026 全国青少年航空航天模型锦标赛",
    category: "youth",
    groups: ["U12", "U15", "U18", "学校团体"],
    status: "upcoming",
    startAt: "2026-08-18",
    endAt: "2026-08-23",
    deadline: "2026-07-28 23:59",
    location: "宁夏银川市体育中心",
    organizer: "青少年航空航天模型竞赛组委会",
    summary: "面向学校和青少年队伍，覆盖自由飞、遥控飞行与航天模型项目。",
    imageUrl: images.aircraft,
    registrationUrl: "/index/Schedule/detail.html?id=260818",
    rulesUrl: "/downloads/youth-aero-2026-rules.pdf",
    resultUrl: "/news/youth-aero-announcement",
    certificateUrl: legacyUrls.certificate,
    schedule: [
      { time: "08月18日 10:00", title: "团队报到", detail: "学校和机构队伍集中报到。" },
      { time: "08月19日 09:00", title: "分项目预赛", detail: "自由飞、遥控和航天模型同步开赛。" },
      { time: "08月23日 09:30", title: "团体奖项确认", detail: "完成奖项复核并开放成绩公示。" }
    ],
    documents: [
      { title: "青少年赛报名须知.pdf", type: "PDF", url: "/downloads/youth-guide.pdf" },
      { title: "学校团体报名模板.xlsx", type: "XLSX", url: "/downloads/school-team-template.xlsx" }
    ],
    results: []
  },
  {
    id: "rocket-invitational-2025",
    title: "2025 航天模型创新邀请赛总决赛",
    category: "space",
    groups: ["S3A", "S6A", "创新设计"],
    status: "completed",
    startAt: "2025-11-08",
    endAt: "2025-11-11",
    location: "重庆两江新区航空科创基地",
    organizer: "航天模型创新竞赛委员会",
    summary: "围绕航天模型设计、发射与回收评审，成绩册已开放查询。",
    imageUrl: images.runway,
    registrationUrl: "/index/Schedule/detail.html?id=251108",
    rulesUrl: "/downloads/rocket-final-rules.pdf",
    resultUrl: "/news/rocket-final-results",
    certificateUrl: legacyUrls.certificate,
    schedule: [
      { time: "11月08日 09:00", title: "技术答辩", detail: "创新设计项目现场答辩。" },
      { time: "11月09日 10:00", title: "发射轮次", detail: "S3A、S6A 项目飞行轮次。" },
      { time: "11月11日 15:00", title: "闭幕式", detail: "最终排名确认并颁奖。" }
    ],
    documents: [
      { title: "总决赛成绩册.pdf", type: "PDF", url: "/downloads/rocket-final-results.pdf" }
    ],
    results: [
      { rank: 1, name: "广州航天一队", team: "广州青少年科技中心", project: "创新设计", score: "94.6" },
      { rank: 2, name: "重庆星火队", team: "重庆两江新区", project: "S6A", score: "91.3" }
    ]
  }
];

const articles: Article[] = [
  {
    id: "rules-nanjing-open",
    title: "关于发布 2026 全国航空模型公开赛（南京站）竞赛规程的通知",
    category: "notice",
    publishedAt: "2026-05-06",
    source: "Lusie 赛事服务中心",
    summary: "南京站规程、报名截止时间、器材检录要求和报到材料清单已发布。",
    attachment: "南京站竞赛规程.pdf",
    sections: [
      { title: "比赛名称", body: "2026 全国航空模型公开赛（南京站）将于 2026 年 7 月 12 日至 7 月 16 日举行。" },
      { title: "报名与检录", body: "参赛者需登录报名系统提交个人或团体信息，并在报到当日完成器材检录。" },
      { title: "附件说明", body: "竞赛规程、动作表和报到材料清单可在下载中心直接获取。" }
    ]
  },
  {
    id: "shanghai-drone-live-results",
    title: "上海无人机竞速公开赛实时成绩公示",
    category: "score",
    publishedAt: "2026-05-11",
    source: "上海站竞赛委员会",
    summary: "专业组与校园组预赛成绩已同步，最终成绩以裁判长签字版本为准。",
    attachment: "上海站实时成绩单.pdf",
    sections: [
      { title: "公示范围", body: "本次公示覆盖 5 月 10 日至 5 月 11 日已完成轮次。" },
      { title: "申诉方式", body: "如对成绩有异议，请由领队在公示后 30 分钟内向仲裁委员会提交书面申诉。" }
    ]
  },
  {
    id: "institution-registration-guide",
    title: "学校与机构组织报名操作说明",
    category: "download",
    publishedAt: "2026-04-28",
    source: "Lusie 技术支持",
    summary: "说明机构账号登录、队员批量导入、项目材料提交和审核查询路径。",
    attachment: "机构组织报名操作手册.pdf",
    sections: [
      { title: "适用对象", body: "学校、俱乐部、培训机构和协会分支机构均可按本说明组织报名。" },
      { title: "机构入口", body: "机构登录由既有业务系统承接，Lusie 提供清楚入口和操作说明。" }
    ]
  },
  {
    id: "academy-model-selection",
    title: "第一次参赛应该选择什么项目？",
    category: "news",
    publishedAt: "2026-04-20",
    source: "Model 学院",
    summary: "按年龄、器材、场地和训练周期，帮助新手选到合适项目。",
    coverUrl: images.classroom,
    sections: [
      { title: "新手优先级", body: "优先选择规则清晰、器材安全边界明确、训练周期可控的项目。" },
      { title: "推荐路径", body: "低龄组选自由飞或基础航天模型，已有遥控经验的选手可进入固定翼或多旋翼项目。" }
    ]
  },
  {
    id: "media-recap-drone",
    title: "无人机竞速分站赛影像回顾：速度、纪律与团队协作",
    category: "recap",
    publishedAt: "2026-04-12",
    source: "赛事媒体组",
    summary: "回顾分站赛的赛道调度、检录流程和优秀飞手表现。",
    coverUrl: images.drone,
    sections: [
      { title: "赛事回顾", body: "影像回顾聚焦赛场组织、飞手准备和裁判计时系统。" },
      { title: "作品案例", body: "后续 Model 学院将沉淀常青作品案例，避免用过旧内容填充入口。" }
    ]
  }
];

const downloads: DownloadResource[] = [
  {
    id: "rules-nanjing",
    title: "2026 全国航空模型公开赛（南京站）竞赛规程",
    competition: "南京站公开赛",
    type: "rules",
    uploadedAt: "2026-05-06",
    fileType: "PDF",
    size: "2.8 MB",
    url: "/downloads/rules-nanjing-open-2026.pdf"
  },
  {
    id: "guide-registration",
    title: "个人与机构报名操作手册",
    competition: "全部赛事",
    type: "guide",
    uploadedAt: "2026-04-28",
    fileType: "PDF",
    size: "3.4 MB",
    url: "/downloads/registration-manual.pdf"
  },
  {
    id: "score-shanghai",
    title: "上海无人机竞速公开赛实时成绩单",
    competition: "上海无人机竞速公开赛",
    type: "score",
    uploadedAt: "2026-05-11",
    fileType: "XLSX",
    size: "620 KB",
    url: "/downloads/shanghai-live-score.xlsx"
  },
  {
    id: "judge-manual",
    title: "裁判评分系统操作手册",
    competition: "全部赛事",
    type: "manual",
    uploadedAt: "2026-03-15",
    fileType: "DOCX",
    size: "940 KB",
    url: "/downloads/judge-manual.docx"
  },
  {
    id: "brand-kit",
    title: "赛事宣传规范与合作标识包",
    competition: "全部赛事",
    type: "brand",
    uploadedAt: "2026-02-02",
    fileType: "ZIP",
    size: "18.6 MB",
    url: "/downloads/lusie-brand-kit.zip"
  }
];

const faqs: FAQItem[] = [
  { id: "account-1", topic: "account", question: "忘记登录密码怎么办？", answer: "在登录页使用找回密码。手机号已停用时，请联系账号支持并准备身份证明。" },
  { id: "registration-1", topic: "registration", question: "个人和机构报名有什么区别？", answer: "个人报名适合独立参赛者；学校、俱乐部和协会队伍建议用机构账号统一导入队员和材料。" },
  { id: "upload-1", topic: "upload", question: "作品或器材资料上传后还能修改吗？", answer: "报名截止前可在报名系统内修改。进入审核后，需要联系赛务人员退回后再提交。" },
  { id: "review-1", topic: "review", question: "审核状态一直没有变化怎么办？", answer: "先确认材料是否完整。超过 3 个工作日仍未更新，请联系报名与赛务咨询。" },
  { id: "score-1", topic: "score", question: "成绩公示和最终成绩有什么区别？", answer: "成绩公示用于申诉期确认；最终成绩以裁判长签字并发布的成绩册为准。" },
  { id: "certificate-1", topic: "certificate", question: "证书在哪里下载？", answer: "从赛事详情页进入证书查询，并使用参赛报名账号登录下载。" },
  { id: "institution-1", topic: "institution", question: "学校老师如何批量组织报名？", answer: "使用机构账号登录，下载报名模板，批量导入队员后提交项目材料。" }
];

const serviceChannels = [
  { title: "报名与赛务", icon: <ClipboardCheck size={22} />, email: "reg@lusie.org", phone: "010-1234-5678 转 1", note: "报名流程、资格审核、赛程安排" },
  { title: "账号与技术", icon: <LifeBuoy size={22} />, email: "tech@lusie.org", phone: "010-1234-5678 转 2", note: "登录异常、资料上传、成绩或证书入口" },
  { title: "机构合作", icon: <Building2 size={22} />, email: "bd@lusie.org", phone: "010-1234-5678 转 3", note: "承办单位、学校机构、器材服务商合作" },
  { title: "媒体联系", icon: <Newspaper size={22} />, email: "pr@lusie.org", phone: "010-1234-5678 转 4", note: "采访申请、影像授权、官方发布" }
];

export function App() {
  const [route, setRoute] = useState<RouteState>(() => readRoute());

  useEffect(() => {
    const handlePopState = () => setRoute(readRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (to: string) => {
    if (to.startsWith("http") || to.startsWith("/index/") || to.startsWith("/user/") || to.startsWith("/merchants/")) {
      window.location.href = to;
      return;
    }

    if (`${window.location.pathname}${window.location.search}` !== to) {
      window.history.pushState(null, "", to);
    }
    setRoute(readRoute());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const normalizedPath = normalizeLegacyRoute(route);

  return (
    <NavigateContext.Provider value={navigate}>
      <div className="site-shell">
        <SkipLink />
        <Header pathname={normalizedPath} />
        <main id="main" className="site-main">
          <RouteRenderer pathname={normalizedPath} search={route.search} />
        </main>
        <Footer />
      </div>
    </NavigateContext.Provider>
  );
}

function readRoute(): RouteState {
  return { pathname: window.location.pathname, search: window.location.search };
}

function normalizeLegacyRoute(route: RouteState) {
  const params = new URLSearchParams(route.search);
  if (route.pathname === "/index/schedule/index") return "/competitions";
  if (route.pathname === "/index/index/js") return "/guide/registration";
  if (route.pathname === "/index/index/mod" || route.pathname === "/index/common/building") return "/academy";
  if (route.pathname === "/index/about/index") return "/about";
  if (route.pathname === "/index/common/contactus") return "/contact";
  if (route.pathname === "/index/article/index") {
    const cid = params.get("cid");
    if (cid === "80") return "/downloads";
    if (cid === "91") return "/faq";
    if (cid === "82" || cid === "83") return "/news";
  }
  return route.pathname === "/" ? "/" : route.pathname.replace(/\/$/, "");
}

function RouteRenderer({ pathname, search }: RouteState) {
  if (pathname.startsWith("/index/") || pathname.startsWith("/user/") || pathname.startsWith("/merchants/")) {
    return <LegacyHandoffPage pathname={pathname} search={search} />;
  }

  if (pathname.startsWith("/competitions/")) {
    return <CompetitionDetail id={pathname.split("/").filter(Boolean)[1]} />;
  }
  if (pathname.startsWith("/news/")) {
    return <NewsDetail id={pathname.split("/").filter(Boolean)[1]} />;
  }

  switch (pathname) {
    case "/":
      return <HomePage />;
    case "/competitions":
      return <CompetitionCenter />;
    case "/news":
      return <NewsList search={search} />;
    case "/downloads":
      return <DownloadCenter />;
    case "/guide/registration":
      return <RegistrationGuide />;
    case "/faq":
      return <FAQPage />;
    case "/academy":
      return <AcademyPage />;
    case "/about":
      return <AboutPage />;
    case "/contact":
      return <ContactPage />;
    case "/privacy":
      return <PolicyPage kind="privacy" />;
    case "/terms":
      return <PolicyPage kind="terms" />;
    case "/anti-fraud":
      return <PolicyPage kind="anti-fraud" />;
    case "/organization":
      return <PolicyPage kind="organization" />;
    case "/brand":
      return <PolicyPage kind="brand" />;
    default:
      return <NotFoundPage />;
  }
}

function AppLink({
  children,
  className,
  to,
  ariaCurrent
}: {
  children: ReactNode;
  className?: string;
  to: string;
  ariaCurrent?: "page";
}) {
  const navigate = useContext(NavigateContext);
  const isExternal = to.startsWith("http") || to.startsWith("/index/") || to.startsWith("/user/") || to.startsWith("/merchants/");

  return (
    <a
      aria-current={ariaCurrent}
      className={className}
      href={to}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
      rel={isExternal ? "noreferrer" : undefined}
      target={isExternal ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

function SkipLink() {
  return (
    <a className="skip-link" href="#main">
      跳到主要内容
    </a>
  );
}

function Header({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const navItems = [
    { label: "赛事中心", to: "/competitions" },
    { label: "新闻公告", to: "/news" },
    { label: "下载中心", to: "/downloads" },
    { label: "报名指南", to: "/guide/registration" },
    { label: "Model 学院", to: "/academy" },
    { label: "联系我们", to: "/about" }
  ];

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <header className="site-header">
      <div className="header-inner">
        <AppLink className="brand-mark" to="/">
          <span className="brand-emblem"><Plane size={20} /></span>
          <span>Lusie</span>
        </AppLink>
        <nav className="desktop-nav" aria-label="主导航">
          {navItems.map((item) => (
            <AppLink
              ariaCurrent={isActive(item.to) ? "page" : undefined}
              className={isActive(item.to) ? "nav-link active" : "nav-link"}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </AppLink>
          ))}
        </nav>
        <div className="header-actions">
          <AppLink className="button ghost small" to={legacyUrls.login}>登录</AppLink>
          <AppLink className="button primary small" to={legacyUrls.participantRegister}>注册参赛</AppLink>
          <button className="icon-button mobile-menu-button" type="button" onClick={() => setOpen((current) => !current)} aria-label={open ? "关闭菜单" : "打开菜单"}>
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="mobile-nav" aria-label="移动端导航">
          {navItems.map((item) => (
            <AppLink className={isActive(item.to) ? "mobile-nav-link active" : "mobile-nav-link"} key={item.to} to={item.to}>
              {item.label}
            </AppLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

function HomePage() {
  const primaryCompetition = competitions[0];
  const notices = articles.filter((article) => article.category === "notice" || article.category === "score").slice(0, 3);

  return (
    <>
      <section className="hero-section">
        <div className="hero-media">
          <img alt="航空模型比赛场地" src={primaryCompetition.imageUrl} />
        </div>
        <div className="hero-overlay" />
        <div className="hero-grid page-container">
          <div className="hero-copy">
            <Badge tone="blue">当前主赛事</Badge>
            <h1>{primaryCompetition.title}</h1>
            <p>{primaryCompetition.summary}</p>
            <div className="hero-meta">
              <Meta icon={<CalendarDays size={18} />} label={`${primaryCompetition.startAt} 至 ${primaryCompetition.endAt}`} />
              <Meta icon={<MapPin size={18} />} label={primaryCompetition.location} />
            </div>
            <div className="button-row">
              <AppLink className="button danger" to={primaryCompetition.registrationUrl}>
                查看报名入口 <ExternalLink size={17} />
              </AppLink>
              <AppLink className="button inverse" to={`/competitions/${primaryCompetition.id}`}>
                查看赛事详情 <ArrowRight size={17} />
              </AppLink>
              <AppLink className="button text" to="/guide/registration">先看报名流程</AppLink>
            </div>
          </div>
          <div className="dispatch-panel">
            <div className="dispatch-head">
              <span>服务调度台</span>
              <strong>OPEN</strong>
            </div>
            <div className="deadline-card">
              <span>报名截止</span>
              <strong>{primaryCompetition.deadline}</strong>
              <p>先核对组别和材料，再进入报名系统提交。</p>
            </div>
            <div className="dispatch-list">
              <StatusLine label="规则文件" value="3 份可下载" />
              <StatusLine label="赛事状态" value={statusMeta[primaryCompetition.status].label} />
              <StatusLine label="机构入口" value="批量报名" />
            </div>
          </div>
        </div>
      </section>

      <QuickAccess />

      <section className="page-section page-container">
        <SectionHeader eyebrow="Competition Center" title="正在开放的赛事" action={<AppLink to="/competitions">查看全部赛事 <ArrowRight size={16} /></AppLink>} />
        <div className="competition-grid">
          {competitions.slice(0, 3).map((competition) => (
            <CompetitionCard competition={competition} key={competition.id} />
          ))}
        </div>
      </section>

      <section className="page-section muted-band">
        <div className="page-container split-layout">
          <div>
            <SectionHeader eyebrow="Official Notices" title="重要通知先看这里" />
            <div className="notice-stack">
              {notices.map((article) => (
                <ArticleRow article={article} key={article.id} />
              ))}
            </div>
          </div>
          <GuidePreview />
        </div>
      </section>

      <section className="page-section page-container">
        <div className="service-grid">
          <FeaturePanel
            icon={<Trophy size={24} />}
            title="成绩与证书"
            copy="成绩公示、最终成绩和证书入口分开呈现，避免在新闻列表里反复查找。"
            to="/news?category=score"
            action="查看成绩公示"
          />
          <FeaturePanel
            icon={<GraduationCap size={24} />}
            title="Model 学院"
            copy="按年龄、经验和器材条件，帮新手先选对项目，再准备材料。"
            to="/academy"
            action="查看入门建议"
          />
          <FeaturePanel
            icon={<Building2 size={24} />}
            title="机构组织报名"
            copy="学校、俱乐部和协会可进入机构后台，批量导入队员和报名材料。"
            to={legacyUrls.institutionLogin}
            action="机构登录"
          />
        </div>
      </section>

      <ContactStrip />
    </>
  );
}

function QuickAccess() {
  const quickLinks = [
    { title: "找赛事", icon: <UserPlus size={24} />, to: "/competitions", note: "筛选可报名项目" },
    { title: "下规则", icon: <Download size={24} />, to: "/downloads", note: "规程和表格直达" },
    { title: "查成绩", icon: <Trophy size={24} />, to: "/news?category=score", note: "公示与最终成绩" },
    { title: "取证书", icon: <Award size={24} />, to: legacyUrls.certificate, note: "用报名账号登录" },
    { title: "问问题", icon: <LifeBuoy size={24} />, to: "/contact", note: "按问题类型联系" }
  ];

  return (
    <section className="quick-access page-container" aria-label="快捷入口">
      {quickLinks.map((link) => (
        <AppLink className="quick-card" key={link.title} to={link.to}>
          {link.icon}
          <strong>{link.title}</strong>
          <span>{link.note}</span>
        </AppLink>
      ))}
    </section>
  );
}

function CompetitionCenter() {
  const [status, setStatus] = useState<CompetitionStatus | "all">("all");
  const [category, setCategory] = useState<CompetitionCategory | "all">("all");
  const [keyword, setKeyword] = useState("");

  const filtered = competitions.filter((competition) => {
    const statusMatch = status === "all" || competition.status === status;
    const categoryMatch = category === "all" || competition.category === category;
    const keywordMatch = `${competition.title} ${competition.location} ${competition.groups.join(" ")}`
      .toLowerCase()
      .includes(keyword.trim().toLowerCase());
    return statusMatch && categoryMatch && keywordMatch;
  });

  return (
    <div className="page-container page-stack">
      <PageTitle
        eyebrow="Competition Center"
        title="赛事中心"
        copy="按状态、项目和地点筛选赛事。看清截止时间、规则和材料后再报名。"
      />
      <section className="filter-panel">
        <div className="tabs" role="tablist" aria-label="赛事状态">
          {(["all", "open", "running", "upcoming", "completed"] as Array<CompetitionStatus | "all">).map((item) => (
            <button className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)} type="button">
              {item === "all" ? "全部状态" : statusMeta[item].label}
            </button>
          ))}
        </div>
        <div className="filter-controls">
          <label className="search-box">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索赛事、地点或组别" />
          </label>
          <label className="select-box">
            <Filter size={18} />
            <select value={category} onChange={(event) => setCategory(event.target.value as CompetitionCategory | "all")}>
              <option value="all">全部类别</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {filtered.length ? (
        <section className="competition-grid">
          {filtered.map((competition) => (
            <CompetitionCard competition={competition} detailed key={competition.id} />
          ))}
        </section>
      ) : (
        <EmptyState title="没有找到符合条件的赛事" copy="换一个状态、类别或关键词试试；也可以先看报名材料怎么准备。" action={<AppLink className="button primary" to="/guide/registration">查看报名指南</AppLink>} />
      )}
    </div>
  );
}

function CompetitionDetail({ id }: { id: string }) {
  const competition = competitions.find((item) => item.id === id) ?? competitions[0];
  const relatedArticles = articles.filter((article) => article.category === "notice" || article.category === "score").slice(0, 2);

  return (
    <div className="page-container page-stack">
      <div className="login-banner">
        <Info size={21} />
        <p>登录后可提交报名、查看个人成绩或下载证书。提交类操作会进入业务系统。</p>
        <AppLink className="button ghost small" to={legacyUrls.login}>前往登录</AppLink>
      </div>

      <section className="detail-hero">
        <div className="detail-copy">
          <Badge tone={statusMeta[competition.status].tone}>{statusMeta[competition.status].label}</Badge>
          <h1>{competition.title}</h1>
          <p>{competition.summary}</p>
          <div className="detail-meta-grid">
            <Meta icon={<CalendarDays size={18} />} label={`${competition.startAt} 至 ${competition.endAt}`} />
            <Meta icon={<MapPin size={18} />} label={competition.location} />
            <Meta icon={<Users size={18} />} label={competition.groups.join(" / ")} />
            <Meta icon={<Building2 size={18} />} label={competition.organizer} />
          </div>
        </div>
        <div className="detail-action-card">
          <img alt={competition.title} src={competition.imageUrl} />
          <div className="button-column">
            <AppLink className="button danger" to={competition.registrationUrl}>进入报名入口 <ExternalLink size={17} /></AppLink>
            <AppLink className="button ghost" to={competition.rulesUrl}>下载竞赛规程 <Download size={17} /></AppLink>
            <AppLink className="button ghost" to={competition.certificateUrl}>证书查询 <ExternalLink size={17} /></AppLink>
          </div>
          {competition.deadline ? <p className="deadline-note">报名截止：{competition.deadline}</p> : null}
        </div>
      </section>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="content-card">
            <SectionHeader eyebrow="Overview" title="参赛前先确认这些信息" />
            <p>{competition.summary} 本页把规则、报名、成绩和证书入口拆开，方便按任务顺序处理。</p>
          </section>
          <section className="content-card">
            <SectionHeader eyebrow="Documents" title="规则与报名材料" />
            <div className="document-list">
              {competition.documents.map((document) => (
                <AppLink className="document-row" key={document.title} to={document.url}>
                  <FileText size={20} />
                  <span>{document.title}</span>
                  <Badge tone="neutral">{document.type}</Badge>
                  <Download size={18} />
                </AppLink>
              ))}
            </div>
          </section>
          <section className="content-card">
            <SectionHeader eyebrow="Schedule" title="关键日程" />
            <div className="timeline">
              {competition.schedule.map((item) => (
                <div className="timeline-item" key={`${item.time}-${item.title}`}>
                  <span>{item.time}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="content-card">
            <SectionHeader eyebrow="Results" title="成绩与奖项" action={<AppLink to={competition.resultUrl}>查看完整成绩 <ArrowRight size={16} /></AppLink>} />
            {competition.results.length ? <ResultsTable rows={competition.results} /> : <EmptyState compact title="成绩尚未发布" copy="比赛开始后会显示成绩公示；最终成绩以官方成绩册为准。" />}
          </section>
        </div>
        <aside className="detail-sidebar">
          <section className="content-card">
            <h3>相关通知</h3>
            <div className="sidebar-list">
              {relatedArticles.map((article) => (
                <AppLink key={article.id} to={`/news/${article.id}`}>
                  <span>{articleCategoryLabels[article.category]}</span>
                  <strong>{article.title}</strong>
                  <small>{article.publishedAt}</small>
                </AppLink>
              ))}
            </div>
          </section>
          <section className="content-card support-card">
            <LifeBuoy size={24} />
            <h3>赛事支持</h3>
            <p>报名、规则或成绩入口不确定时，按问题类型找到对应联系人。</p>
            <AppLink className="button primary" to="/contact">查看联系渠道</AppLink>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NewsList({ search }: { search: string }) {
  const params = new URLSearchParams(search);
  const legacyCategory = params.get("cid") === "82" ? "notice" : params.get("cid") === "83" ? "news" : null;
  const initialCategory = (params.get("category") as ArticleCategory | null) ?? legacyCategory;
  const [category, setCategory] = useState<ArticleCategory | "all">(initialCategory ?? "all");
  const [keyword, setKeyword] = useState("");

  const filtered = articles.filter((article) => {
    const categoryMatch = category === "all" || article.category === category;
    const keywordMatch = `${article.title} ${article.summary}`.toLowerCase().includes(keyword.trim().toLowerCase());
    return categoryMatch && keywordMatch;
  });

  return (
    <div className="page-container page-stack">
      <PageTitle eyebrow="News Center" title="公告与成绩" copy="官方通知、成绩公示、资料更新和媒体回顾分开浏览，重要信息更容易找到。" />
      <section className="news-layout">
        <div>
          <div className="filter-panel news-filter">
            <div className="tabs scroll-tabs">
              {(["all", "notice", "news", "score", "download", "recap"] as Array<ArticleCategory | "all">).map((item) => (
                <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)} type="button">
                  {item === "all" ? "全部" : articleCategoryLabels[item]}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={18} />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索公告、成绩或附件" />
            </label>
          </div>
          <div className="article-list">
            {filtered.map((article) => (
              <ArticleRow article={article} expanded key={article.id} />
            ))}
          </div>
        </div>
        <aside className="news-sidebar">
          <section className="content-card pinned-card">
            <Bell size={22} />
            <h3>置顶重要公告</h3>
            <AppLink to="/news/rules-nanjing-open">2026 南京站竞赛规程已发布</AppLink>
            <AppLink to="/guide/registration">报名流程与材料准备说明</AppLink>
          </section>
          <section className="content-card">
            <h3>快速筛选</h3>
            <div className="chip-cloud">
              <button type="button" onClick={() => setCategory("notice")}>官方通知</button>
              <button type="button" onClick={() => setCategory("score")}>成绩公示</button>
              <button type="button" onClick={() => setKeyword("附件")}>含附件</button>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function NewsDetail({ id }: { id: string }) {
  const article = articles.find((item) => item.id === id) ?? articles[0];
  const related = articles.filter((item) => item.id !== article.id && item.category === article.category).slice(0, 3);

  return (
    <div className="page-container article-detail-layout">
      <article className="article-detail">
        <header>
          <Badge tone={article.category === "notice" ? "red" : "blue"}>{articleCategoryLabels[article.category]}</Badge>
          <h1>{article.title}</h1>
          <div className="article-meta">
            <span>{article.publishedAt}</span>
            <span>{article.source}</span>
          </div>
          <p>{article.summary}</p>
          {article.attachment ? (
            <AppLink className="attachment-card" to="/downloads">
              <FileText size={22} />
              <span>{article.attachment}</span>
              <Download size={18} />
            </AppLink>
          ) : null}
        </header>
        {article.coverUrl ? <img className="article-cover" alt={article.title} src={article.coverUrl} /> : null}
        <div className="article-body">
          {article.sections.map((section, index) => (
            <section id={`section-${index + 1}`} key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </article>
      <aside className="article-aside">
        <section className="content-card toc-card">
          <h3>目录</h3>
          {article.sections.map((section, index) => (
            <a href={`#section-${index + 1}`} key={section.title}>{section.title}</a>
          ))}
        </section>
        <section className="content-card">
          <h3>相关内容</h3>
          <div className="sidebar-list">
            {related.length ? related.map((item) => (
              <AppLink key={item.id} to={`/news/${item.id}`}>
                <span>{articleCategoryLabels[item.category]}</span>
                <strong>{item.title}</strong>
              </AppLink>
            )) : <p className="muted-text">暂无同类内容。</p>}
          </div>
        </section>
      </aside>
    </div>
  );
}

function DownloadCenter() {
  const [type, setType] = useState<DownloadType | "all">("all");
  const [keyword, setKeyword] = useState("");
  const filtered = downloads.filter((resource) => {
    const typeMatch = type === "all" || resource.type === type;
    const keywordMatch = `${resource.title} ${resource.competition}`.toLowerCase().includes(keyword.trim().toLowerCase());
    return typeMatch && keywordMatch;
  });

  return (
    <div className="page-container page-stack">
      <PageTitle eyebrow="Download Center" title="资料下载" copy="规程、手册、成绩单和宣传资料按类型整理，直接下载对应文件。" />
      <section className="filter-panel">
        <label className="search-box">
          <Search size={18} />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索资料或所属赛事" />
        </label>
        <label className="select-box">
          <FileText size={18} />
          <select value={type} onChange={(event) => setType(event.target.value as DownloadType | "all")}>
            <option value="all">全部资料</option>
            {Object.entries(downloadTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </section>
      <section className="download-table" aria-label="下载资料列表">
        <div className="download-row header">
          <span>文件名称</span>
          <span>所属赛事</span>
          <span>日期</span>
          <span>类型/大小</span>
          <span>操作</span>
        </div>
        {filtered.map((resource) => (
          <div className="download-row" key={resource.id}>
            <div>
              <FileText size={20} />
              <strong>{resource.title}</strong>
            </div>
            <span>{resource.competition}</span>
            <span>{resource.uploadedAt}</span>
            <span>{resource.fileType} / {resource.size}</span>
            <AppLink className="button danger small" to={resource.url}>下载文件 <Download size={16} /></AppLink>
          </div>
        ))}
      </section>
    </div>
  );
}

function RegistrationGuide() {
  const steps = [
    ["注册 / 登录账号", "个人参赛者创建账号；学校、俱乐部和协会建议使用机构账号。", <UserPlus size={24} />],
    ["选择赛事与项目", "在赛事中心查看状态、组别、规则文件和报名截止时间。", <Trophy size={24} />],
    ["阅读规则并准备材料", "下载竞赛规程、动作表、器材安全要求和报名材料清单。", <BookOpen size={24} />],
    ["提交报名资料", "进入老系统完成表单填写、作品上传或队员批量导入。", <FileText size={24} />],
    ["等待审核 / 评审", "审核结果会在报名系统中更新，必要时按提示补充材料。", <Clock size={24} />],
    ["查询成绩 / 下载证书", "成绩公示期结束后，可在原系统查看最终成绩和下载证书。", <Award size={24} />]
  ] as const;

  return (
    <div className="page-container page-stack">
      <section className="guide-hero">
        <div>
          <Badge tone="blue">Registration Guide</Badge>
          <h1>先准备材料，再提交报名</h1>
          <p>用 6 步确认账号、赛事、规则、材料、审核和成绩证书，减少来回补交。</p>
        </div>
        <div className="button-row">
          <AppLink className="button danger" to={legacyUrls.participantRegister}>进入报名系统 <ExternalLink size={17} /></AppLink>
          <AppLink className="button ghost" to="/downloads">下载报名手册 <Download size={17} /></AppLink>
        </div>
      </section>
      <section className="step-grid">
        {steps.map(([title, copy, icon], index) => (
          <div className="step-card" key={title}>
            <span>STEP {String(index + 1).padStart(2, "0")}</span>
            {icon}
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
        ))}
      </section>
      <section className="recommend-layout">
        <div>
          <SectionHeader eyebrow="Project Finder" title="不知道选什么项目？" />
          <div className="recommend-grid">
            <Recommendation icon={<Plane size={22} />} title="固定翼特技" copy="适合已有遥控训练基础、希望挑战精确动作的选手。" />
            <Recommendation icon={<Rocket size={22} />} title="航天模型" copy="适合喜欢动手设计、发射和回收验证的青少年队伍。" />
            <Recommendation icon={<PlayCircle size={22} />} title="无人机竞速" copy="适合有 FPV 操作经验、能接受高频训练的选手。" />
            <Recommendation icon={<Users size={22} />} title="学校团体" copy="适合老师统一组织报名、批量提交队员资料和作品。" />
          </div>
        </div>
        <FeaturePanel icon={<HelpCircle size={24} />} title="还有问题？" copy="FAQ 覆盖账号、报名、上传、审核、成绩、证书和机构组织报名。" to="/faq" action="查看常见问题" />
      </section>
    </div>
  );
}

function FAQPage() {
  const [topic, setTopic] = useState<FAQTopic | "all">("all");
  const [keyword, setKeyword] = useState("");
  const filtered = faqs.filter((item) => {
    const topicMatch = topic === "all" || item.topic === topic;
    const keywordMatch = `${item.question} ${item.answer}`.toLowerCase().includes(keyword.trim().toLowerCase());
    return topicMatch && keywordMatch;
  });

  return (
    <div className="page-container page-stack">
      <PageTitle eyebrow="FAQ" title="常见问题" copy="按账号、报名、上传、审核、成绩、证书和机构报名拆分，先找到对应答案。" />
      <section className="filter-panel">
        <div className="tabs scroll-tabs">
          {(["all", "account", "registration", "upload", "review", "score", "certificate", "institution"] as Array<FAQTopic | "all">).map((item) => (
            <button className={topic === item ? "active" : ""} key={item} onClick={() => setTopic(item)} type="button">
              {item === "all" ? "全部" : faqTopicLabels[item]}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={18} />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索问题或关键词" />
        </label>
      </section>
      <section className="faq-list">
        {filtered.map((item) => (
          <details key={item.id}>
            <summary>
              <span>{faqTopicLabels[item.topic]}</span>
              <strong>{item.question}</strong>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}

function AcademyPage() {
  return (
    <div className="page-container page-stack">
      <section className="academy-hero">
        <div>
          <Badge tone="blue">Model Academy</Badge>
          <h1>第一次参赛，从选项目开始</h1>
          <p>按年龄、经验、训练周期和器材预算，先判断适合哪个项目，再进入报名准备。</p>
          <AppLink className="button primary" to="/guide/registration">查看报名准备</AppLink>
        </div>
        <img alt="航空模型学习与制作" src={images.classroom} />
      </section>
      <section className="academy-grid">
        <AcademyCard icon={<Plane size={24} />} title="先报哪个项目？" copy="按年龄、经验、训练周期和器材预算推荐项目。" />
        <AcademyCard icon={<BookOpen size={24} />} title="需要哪些器材？" copy="列出练习机、遥控器、电池、安全工具和检录材料。" />
        <AcademyCard icon={<CheckCircle2 size={24} />} title="评审看什么？" copy="解释安全性、完成度、飞行表现和创新设计的评分口径。" />
        <AcademyCard icon={<PlayCircle size={24} />} title="优秀作品怎么准备？" copy="整理常青作品案例和赛事回放，方便对照训练。" />
      </section>
      <section className="content-card">
        <SectionHeader eyebrow="Coming Later" title="后续学习工具" />
        <div className="chip-cloud">
          <span>在线课程</span>
          <span>附近机构</span>
          <span>器材选择工具</span>
          <span>作品库筛选</span>
        </div>
      </section>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="page-container page-stack">
      <PageTitle eyebrow="About Lusie" title="关于 Lusie" copy="说明平台服务对象、信息范围和报名业务交接方式。" />
      <section className="about-grid">
        <div className="content-card about-main">
          <h2>平台做什么</h2>
          <p>Lusie 面向赛事主办方、承办方、参赛选手、学校机构和裁判团队，集中提供赛事信息、资料下载、成绩公告和服务支持入口。</p>
          <p>登录、报名提交、证书生成和机构后台由既有业务系统承接，页面会在需要提交时给出明确入口。</p>
        </div>
        <FeaturePanel icon={<ShieldCheck size={24} />} title="平台职责" copy="统一展示赛事信息、规程资料、公告、成绩和联系路径。" to="/organization" action="查看职责说明" />
        <FeaturePanel icon={<Users size={24} />} title="服务对象" copy="参赛选手、学校老师、俱乐部、裁判员、承办方和媒体合作方。" to="/contact" action="查看联系渠道" />
      </section>
    </div>
  );
}

function ContactPage() {
  return (
    <div className="page-container page-stack">
      <PageTitle eyebrow="Contact" title="联系我们" copy="按报名、账号、机构合作和媒体需求找到对应联系人。" />
      <section className="contact-grid">
        {serviceChannels.map((channel) => (
          <div className="contact-card" key={channel.title}>
            {channel.icon}
            <h3>{channel.title}</h3>
            <p>{channel.note}</p>
            <a href={`mailto:${channel.email}`}><Mail size={16} /> {channel.email}</a>
            <a href={`tel:${channel.phone.replace(/[^\d]/g, "")}`}><Phone size={16} /> {channel.phone}</a>
          </div>
        ))}
      </section>
      <section className="contact-bottom-grid">
        <div className="content-card">
          <SectionHeader eyebrow="Service Hours" title="服务时间" />
          <StatusLine label="工作日" value="09:00 - 18:00 (GMT+8)" />
          <StatusLine label="周末与法定节假日" value="仅提供紧急技术支持" />
        </div>
        <div className="content-card qr-panel">
          <QrCode size={30} />
          <div>
            <h3>官方媒体矩阵</h3>
            <p>扫码获取赛事公告、报名提醒和手机端查分入口。</p>
          </div>
          <div className="qr-placeholder" aria-label="二维码占位" />
        </div>
      </section>
    </div>
  );
}

function PolicyPage({ kind }: { kind: PolicyKind }) {
  const policy = policyContent[kind];
  return (
    <div className="page-container policy-layout">
      <aside className="policy-toc">
        <h2>目录</h2>
        {policy.sections.map((section, index) => (
          <a href={`#policy-${index + 1}`} key={section.title}>{index + 1}. {section.title}</a>
        ))}
      </aside>
      <article className="policy-article">
        <header>
          <Badge tone="neutral">{policy.label}</Badge>
          <h1>{policy.title}</h1>
          <p>最近更新：{policy.updatedAt} · 适用范围：Lusie 赛事服务页面与相关业务入口。</p>
        </header>
        {policy.sections.map((section, index) => (
          <section id={`policy-${index + 1}`} key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <AppLink className="button ghost" to="/downloads">下载附件版本 <Download size={17} /></AppLink>
      </article>
    </div>
  );
}

const policyContent: Record<PolicyKind, { label: string; title: string; updatedAt: string; sections: Array<{ title: string; body: string }> }> = {
  privacy: {
    label: "Privacy",
    title: "Lusie 隐私政策",
    updatedAt: "2026-05-01",
    sections: [
      { title: "引言", body: "我们仅为赛事报名、成绩公告、证书查询和平台安全处理必要信息。" },
      { title: "收集的信息", body: "可能包含账号信息、报名记录、成绩数据、申诉记录以及访问日志。" },
      { title: "信息使用方式", body: "信息用于身份核验、赛事执行、安全审计、服务通知和合规要求。" },
      { title: "共享与披露", body: "必要信息会按赛事组织需要提供给主办、承办、裁判和管理机构；不会出售给第三方。" },
      { title: "用户权利", body: "用户可按平台规则申请查询、更正或删除个人信息，法律法规另有要求的除外。" }
    ]
  },
  terms: {
    label: "Terms",
    title: "Lusie 使用条款",
    updatedAt: "2026-05-01",
    sections: [
      { title: "服务范围", body: "Lusie 提供赛事信息、资料下载、公告和支持入口，报名等业务提交由既有系统承接。" },
      { title: "用户责任", body: "用户应保证提交材料真实、合法、完整，并遵守赛事规程和平台规则。" },
      { title: "内容与附件", body: "竞赛规程、成绩和证书以官方发布版本为准，附件下载仅供赛事服务使用。" },
      { title: "变更与中止", body: "因赛事安排、系统维护或合规要求，平台可能调整页面内容或入口。" }
    ]
  },
  "anti-fraud": {
    label: "Safety",
    title: "防诈骗提醒",
    updatedAt: "2026-05-01",
    sections: [
      { title: "官方渠道", body: "请通过 Lusie 官网、官方公众号或赛事通知中的链接进入报名和缴费流程。" },
      { title: "敏感信息", body: "工作人员不会索要密码、验证码或要求向私人账户转账。" },
      { title: "可疑信息处理", body: "发现可疑链接、收费或证书代办，请联系账号与技术支持核实。" }
    ]
  },
  organization: {
    label: "Organization",
    title: "组织架构说明",
    updatedAt: "2026-05-01",
    sections: [
      { title: "平台角色", body: "Lusie 承担赛事信息展示、资料分发和服务支持入口职责。" },
      { title: "赛事组织", body: "具体赛事由主办、承办和竞赛委员会负责执行，页面会展示对应单位信息。" },
      { title: "业务系统", body: "登录、报名提交、证书下载和机构后台继续由既有业务系统承接。" }
    ]
  },
  brand: {
    label: "Brand",
    title: "宣传规范",
    updatedAt: "2026-05-01",
    sections: [
      { title: "标识使用", body: "合作单位使用赛事名称、标识和影像素材前，应获得赛事组织方授权。" },
      { title: "信息发布", body: "报名时间、规程、成绩和证书信息应以官网和官方通知为准。" },
      { title: "素材下载", body: "宣传资料、合作标识和媒体素材可在下载中心获取对应版本。" }
    ]
  }
};

function NotFoundPage() {
  return (
    <div className="page-container page-stack">
      <EmptyState
        title="页面未找到"
        copy="这个地址暂未开放。你可以回到首页或进入赛事中心继续查找。"
        action={<AppLink className="button primary" to="/">回到首页</AppLink>}
      />
    </div>
  );
}

function LegacyHandoffPage({ pathname, search }: { pathname: string; search: string }) {
  const fullPath = `${pathname}${search}`;
  const kind = pathname.includes("login")
    ? "登录系统"
    : pathname.includes("register")
      ? "注册系统"
      : pathname.includes("Schedule")
        ? "报名 / 赛事业务系统"
        : pathname.includes("merchants")
          ? "机构后台"
          : "业务系统";

  return (
    <div className="page-container page-stack">
      <section className="legacy-handoff">
        <Badge tone="blue">Legacy System</Badge>
        <h1>即将进入{kind}</h1>
        <p>赛事信息、资料下载和公告可在 Lusie 查看；登录、报名、证书等提交动作会进入既有业务系统。</p>
        <code>{fullPath}</code>
        <div className="button-row">
          <a className="button danger" href={fullPath}>继续打开原系统 <ExternalLink size={17} /></a>
          <AppLink className="button ghost" to="/">回到首页</AppLink>
        </div>
      </section>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-container footer-grid">
        <div>
          <div className="brand-mark footer-brand">
            <span className="brand-emblem"><Plane size={18} /></span>
            <span>Lusie</span>
          </div>
          <p>航空模型竞赛服务入口。集中查看赛事、规程、成绩、证书和支持渠道。</p>
        </div>
        <FooterGroup title="赛事服务" links={[["赛事中心", "/competitions"], ["报名指南", "/guide/registration"], ["下载中心", "/downloads"], ["FAQ", "/faq"]]} />
        <FooterGroup title="平台信息" links={[["关于我们", "/about"], ["联系我们", "/contact"], ["组织架构", "/organization"], ["防诈骗提醒", "/anti-fraud"]]} />
        <FooterGroup title="法律与规范" links={[["隐私政策", "/privacy"], ["使用条款", "/terms"], ["宣传规范", "/brand"]]} />
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div className="footer-group">
      <h3>{title}</h3>
      {links.map(([label, to]) => (
        <AppLink key={to} to={to}>{label}</AppLink>
      ))}
    </div>
  );
}

function CompetitionCard({ competition, detailed = false }: { competition: Competition; detailed?: boolean }) {
  const meta = statusMeta[competition.status];
  const actionUrl = competition.status === "open" ? competition.registrationUrl : competition.status === "completed" ? competition.resultUrl : `/competitions/${competition.id}`;

  return (
    <article className="competition-card">
      {detailed ? <img alt={competition.title} src={competition.imageUrl} /> : null}
      <div className="card-body">
        <div className="card-title-row">
          <h3>{competition.title}</h3>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <p>{competition.summary}</p>
        <div className="card-facts">
          <StatusLine label="时间" value={`${competition.startAt} 至 ${competition.endAt}`} />
          <StatusLine label="地点" value={competition.location} />
          <StatusLine label="组别" value={competition.groups.join(" / ")} />
          {competition.deadline ? <StatusLine label="截止" value={competition.deadline} /> : null}
        </div>
      </div>
      <div className="card-actions">
      <AppLink className="button ghost small" to={`/competitions/${competition.id}`}>查看详情</AppLink>
        <AppLink className={competition.status === "open" ? "button danger small" : "button primary small"} to={actionUrl}>
          {meta.action}
          {actionUrl.startsWith("/index/") ? <ExternalLink size={15} /> : <ChevronRight size={15} />}
        </AppLink>
      </div>
    </article>
  );
}

function ArticleRow({ article, expanded = false }: { article: Article; expanded?: boolean }) {
  return (
    <article className={expanded ? "article-row expanded" : "article-row"}>
      {expanded && article.coverUrl ? <img alt={article.title} src={article.coverUrl} /> : null}
      <div>
        <div className="article-tags">
          <Badge tone={article.category === "notice" || article.category === "score" ? "red" : "blue"}>{articleCategoryLabels[article.category]}</Badge>
          <span>{article.publishedAt}</span>
          {article.attachment ? <span className="attachment-label">含附件</span> : null}
        </div>
        <AppLink className="article-title" to={`/news/${article.id}`}>{article.title}</AppLink>
        <p>{article.summary}</p>
      </div>
    </article>
  );
}

function ResultsTable({ rows }: { rows: Competition["results"] }) {
  return (
    <div className="results-table">
      <div className="results-row header">
        <span>名次</span>
        <span>选手 / 队伍</span>
        <span>项目</span>
        <span>得分</span>
      </div>
      {rows.map((row) => (
        <div className="results-row" key={`${row.rank}-${row.name}`}>
          <span>{row.rank}</span>
          <strong>{row.name}<small>{row.team}</small></strong>
          <span>{row.project}</span>
          <b>{row.score}</b>
        </div>
      ))}
    </div>
  );
}

function GuidePreview() {
  return (
    <div className="guide-preview content-card">
      <SectionHeader eyebrow="Registration" title="报名流程预览" />
      <ol>
        <li>注册 / 登录账号</li>
        <li>选择赛事与项目</li>
        <li>阅读规则并准备材料</li>
        <li>进入老系统提交报名</li>
      </ol>
      <AppLink className="button primary" to="/guide/registration">查看完整流程</AppLink>
    </div>
  );
}

function FeaturePanel({ icon, title, copy, to, action }: { icon: ReactNode; title: string; copy: string; to: string; action: string }) {
  return (
    <div className="feature-panel">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
      <AppLink to={to}>{action} <ArrowRight size={16} /></AppLink>
    </div>
  );
}

function Recommendation({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="recommend-card">
      {icon}
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function AcademyCard({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="academy-card">
      {icon}
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function ContactStrip() {
  return (
    <section className="contact-strip">
      <div className="page-container contact-strip-inner">
        <div>
          <span>遇到问题？</span>
          <h2>按问题类型找到对应联系人。</h2>
        </div>
        <AppLink className="button inverse" to="/contact">查看联系方式 <ArrowRight size={17} /></AppLink>
      </div>
    </section>
  );
}

function PageTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <header className="page-title">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </header>
  );
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}

function Meta({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="meta-item">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function EmptyState({ title, copy, action, compact = false }: { title: string; copy: string; action?: ReactNode; compact?: boolean }) {
  return (
    <section className={compact ? "empty-state compact" : "empty-state"}>
      <Search size={compact ? 22 : 32} />
      <h2>{title}</h2>
      <p>{copy}</p>
      {action}
    </section>
  );
}
