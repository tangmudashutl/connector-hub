/* ===== 模拟数据 ===== */
const NEWS_DATA = [
  { tag:"产业动向", tagColor:"#dbeafe,#2563eb", title:"鸿海股东大会：AI服务器Capex突破7000亿美元大关", excerpt:"鸿海精密工业在年度股东大会上披露，AI服务器相关资本支出已突破7000亿美元，创行业历史新高。", date:"2026-05-28", view:"1.2k" },
  { tag:"市场并购", tagColor:"#fef3c7,#92400e", title:"Belden 18.5亿美元收购Ruckus Networks，布局企业级连接", excerpt:"Belden宣布以18.5亿美元收购Ruckus Networks，强化其在企业级无线连接领域的产品矩阵。", date:"2026-05-27", view:"986" },
  { tag:"IPO动态", tagColor:"#d1fae5,#065f46", title:"维通利(001393)&天海电子(001365)相继IPO过会", excerpt:"两家连接器龙头企业相继通过IPO审核，行业迎来新一轮资本市场热潮，预计募资总额超30亿元。", date:"2026-05-25", view:"2.1k" },
  { tag:"全球布局", tagColor:"#e0e7ff,#3730a3", title:"JST $5亿阿拉巴马全自动化工厂奠基，年产能提升300%", excerpt:"JST在阿拉巴马州的全自动化生产基地正式奠基，总投资5亿美元，预计2027年投产。", date:"2026-05-22", view:"1.5k" },
];

const RD_DATA = [
  { tag:"高速连接器", title:"224G高速背板连接器研发突破，国产替代加速", desc:"国内厂商在224Gbps高速背板连接器领域取得关键技术突破，产品性能达到国际先进水平。", date:"2026-05-30", org:"中航光电" },
  { tag:"新能源", title:"液冷充电连接器新国标发布，最大电流提升至800A", desc:"新版液冷充电连接器国家标准正式发布，支持最大800A充电电流，2026年10月起实施。", date:"2026-05-29", org:"华为/比亚迪" },
  { tag:"射频连接", title:"毫米波相控阵连接器模块研制成功，卫星互联网关键器件国产化", desc:"某科研院所成功研制毫米波相控阵连接器模块，填补国内空白，即将进入量产阶段。", date:"2026-05-27", org:"中国电科" },
];

const TECH_DATA = [
  { title:"高速连接器信号完整性设计：从仿真到实测的全流程方法", desc:"系统介绍高速连接器在112G/224G速率下的信号完整性设计方法，包括仿真建模、测试校准和失效分析。", date:"2026-05-30", tag:"信号完整性" },
  { title:"新能源汽车高压互连系统安全技术规范解读", desc:"解读最新发布的新能源汽车高压互连系统安全技术要求，分析对连接器厂家的技术挑战。", date:"2026-05-28", tag:"高压连接" },
  { title:"光纤连接器研磨工艺优化：从PC到APC的良率提升实践", desc:"某头部厂商分享光纤连接器研磨工艺优化经验，APC研磨良率从92%提升至99.2%。", date:"2026-05-26", tag:"光纤连接" },
  { title:"FPC/FFC连接器小型化趋势下的材料选型指南", desc:"分析FPC连接器在0.2mm pitch下的材料选型策略，对比LCP、改性PI和液晶聚合物的性能差异。", date:"2026-05-24", tag:"材料技术" },
];

const EXPO_DATA = [
  { month:"06月", day:"24-26", title:"electronica Shanghai 2026", desc:"上海新国际博览中心 · 全球最大电子元器件展", badge:"即将开始", badgeColor:"#fef3c7,#92400e" },
  { month:"07月", day:"09-11", title:"深圳国际连接器及线束加工展", desc:"深圳国际会展中心 · 华南地区最大连接器专业展", badge:"报名中", badgeColor:"#dbeafe,#2563eb" },
  { month:"09月", day:"16-18", title:"慕尼黑电子展Electronica 2026", desc:"德国慕尼黑展览中心 · 全球电子行业顶级盛会", badge:"预告", badgeColor:"#d1fae5,#065f46" },
];

const BIZ_DATA = [
  { tag:"产能扩张", title:"立讯精密越南工厂二期投产，新增就业5000人", desc:"立讯精密越南工厂二期正式投产，主要服务北美客户，年产值预计达80亿元。", date:"2026-05-30" },
  { tag:"战略合作", title:"泰科电子与英伟达签署液冷互连长期供货协议", desc:"TE Connectivity宣布与NVIDIA达成长期战略合作，为其AI服务器提供液冷高速互连解决方案。", date:"2026-05-29" },
  { tag:"财务业绩", title:"安费诺Q1营收同比增长23%，AI数据中心业务贡献超60%", desc:"Amphenol发布2026年Q1财报，营收达42亿美元，其中AI数据中心相关产品营收同比增长78%。", date:"2026-05-27" },
];

/* ===== 渲染函数 ===== */
function renderNews() {
  const grid = document.getElementById('newsGrid');
  grid.innerHTML = NEWS_DATA.map(n => {
    const [bg,clr] = n.tagColor.split(',');
    return `<div class="card" onclick="openArticle('${n.title}')">
      <div class="card-img">📰</div>
      <div class="card-body">
        <span class="card-tag" style="background:${bg};color:${clr}">${n.tag}</span>
        <div class="card-title">${n.title}</div>
        <div class="card-excerpt">${n.excerpt}</div>
        <div class="card-meta"><span>📅 ${n.date}</span><span>👁️ ${n.view}</span></div>
      </div>
    </div>`;
  }).join('');
}

function renderRD() {
  const grid = document.getElementById('rdGrid');
  grid.innerHTML = RD_DATA.map(n => {
    const [bg,clr] = '#d1fae5,#065f46'.split(',');
    return `<div class="card" onclick="openArticle('${n.title}')">
      <div class="card-img">🔬</div>
      <div class="card-body">
        <span class="card-tag" style="background:${bg};color:${clr}">${n.tag}</span>
        <div class="card-title">${n.title}</div>
        <div class="card-excerpt">${n.desc}</div>
        <div class="card-meta"><span>🏢 ${n.org}</span><span>📅 ${n.date}</span></div>
      </div>
    </div>`;
  }).join('');
}

function renderTech() {
  const list = document.getElementById('techList');
  list.innerHTML = TECH_DATA.map((t,i) => `<div class="tech-item" onclick="openArticle('${t.title}')">
      <div class="tech-num">${String(i+1).padStart(2,'0')}</div>
      <div class="tech-body">
        <h3>${t.title}</h3>
        <p>${t.desc}</p>
        <div class="tech-meta"><span>📅 ${t.date}</span><span class="card-tag" style="background:#f3f4f6;color:#374151">${t.tag}</span></div>
      </div>
    </div>`).join('');
}

function renderExpo() {
  const tl = document.getElementById('expoTimeline');
  tl.innerHTML = EXPO_DATA.map(e => `<div class="expo-item">
      <div class="expo-date"><div class="month">${e.month}</div><div class="day">${e.day}</div></div>
      <div class="expo-info"><h3>${e.title}</h3><p>${e.desc}</p></div>
      <span class="expo-badge" style="background:${e.badgeColor.split(',')[0]};color:${e.badgeColor.split(',')[1]}">${e.badge}</span>
    </div>`).join('');
}

function renderBiz() {
  const grid = document.getElementById('bizGrid');
  grid.innerHTML = BIZ_DATA.map(n => {
    const colors = {'产能扩张':'#dbeafe,#2563eb','战略合作':'#fef3c7,#92400e','财务业绩':'#d1fae5,#065f46'};
    const [bg,clr] = colors[n.tag].split(',');
    return `<div class="card" onclick="openArticle('${n.title}')">
      <div class="card-img">📊</div>
      <div class="card-body">
        <span class="card-tag" style="background:${bg};color:${clr}">${n.tag}</span>
        <div class="card-title">${n.title}</div>
        <div class="card-excerpt">${n.desc}</div>
        <div class="card-meta"><span>📅 ${n.date}</span></div>
      </div>
    </div>`;
  }).join('');
}

/* ===== 交互 ===== */
function openArticle(title) { showToast(`即将打开：${title}`); }

function showModal(id) { document.getElementById(id).classList.add('open'); }
function hideModal(id) { document.getElementById(id).classList.remove('open'); }

function showModal(id, type) {
  document.getElementById(id).classList.add('open');
  if (type) {
    const title = document.getElementById('contactModalTitle');
    if (title) title.textContent = `🤝 商务对接 - ${type}`;
  }
}

function submitForm() {
  const title = document.getElementById('submitTitle').value.trim();
  if (!title) { showToast('请填写标题'); return; }
  hideModal('submitModal');
  showToast('提交成功！审核通过后即可发布。');
  document.getElementById('submitTitle').value = '';
  document.getElementById('submitContent').value = '';
}

function submitContactForm() {
  const name = document.getElementById('contactName').value.trim();
  if (!name) { showToast('请填写姓名'); return; }
  hideModal('contactModal');
  showToast('提交成功！我们会在1个工作日内联系您。');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function toggleMobileMenu() { document.getElementById('mobileMenu').classList.toggle('open'); }
function closeMobileMenu() { document.getElementById('mobileMenu').classList.remove('open'); }

/* ===== 导航高亮 ===== */
document.addEventListener('DOMContentLoaded', () => {
  renderNews();
  renderRD();
  renderTech();
  renderExpo();
  renderBiz();
  animateCounters();

  // 导航点击高亮
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      e.target.classList.add('active');
      closeMobileMenu();
    });
  });

  // 滚动高亮
  const sections = document.querySelectorAll('.section, .hero');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 120) current = s.id;
    });
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === '#'+current);
    });
  });
});

/* ===== 数字动画 ===== */
function animateCounters() {
  const counters = document.querySelectorAll('.stat-num');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = +el.dataset.target;
      let current = 0;
      const step = Math.max(1, Math.floor(target / 60));
      const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = current.toLocaleString();
      }, 25);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}
