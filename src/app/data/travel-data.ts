import { Destination } from '../models/travel.model';

export const DESTINATIONS: Destination[] = [
  {
    id: 'chengdu',
    name: '成都',
    region: '四川 · 中国',
    intro: '悠闲的烟火之城，熊猫与美食的天堂。',
    dailyTransport: 40,
    tips: ['火锅和串串建议错峰用餐，饭点排队较长。', '大熊猫基地建议一早前往，上午熊猫更活跃。', '市区景点间地铁+共享单车最方便。'],
    climate: {
      avgHigh: [10, 12, 17, 22, 26, 28, 31, 30, 26, 21, 16, 11],
      avgLow: [3, 5, 9, 14, 18, 21, 23, 23, 19, 14, 9, 4],
      rainyMonths: [7, 8],
      bestMonths: [3, 4, 5, 9, 10, 11],
      note: '春秋两季最舒适；夏季闷热多雨，冬季湿冷但极少降雪。'
    },
    attractions: [
      { name: '大熊猫繁育研究基地', category: 'nature', categories: ['nature', 'amusement'], purposes: ['family', 'relax', 'photo'], cost: 58, hours: 3, description: '近距离看憨态可掬的国宝大熊猫。' },
      { name: '宽窄巷子', category: 'history', categories: ['history', 'city', 'food'], purposes: ['culture', 'photo', 'relax'], cost: 0, hours: 2, description: '老成都院落文化与茶馆、小吃交织。' },
      { name: '锦里古街', category: 'food', categories: ['food', 'history'], purposes: ['foodie', 'culture'], cost: 0, hours: 2, description: '三国主题古街，边逛边吃地道小吃。' },
      { name: '都江堰', category: 'history', categories: ['history', 'nature'], purposes: ['culture', 'adventure'], cost: 80, hours: 4, description: '千年水利工程，感受古人智慧与山水。' },
      { name: '青城山', category: 'nature', categories: ['nature', 'adventure'], purposes: ['adventure', 'relax', 'culture'], cost: 80, hours: 5, description: '道教名山，清幽静谧的徒步胜地。' },
      { name: '人民公园·鹤鸣茶社', category: 'relax', categories: ['relax', 'city'], purposes: ['relax', 'culture'], cost: 20, hours: 2, description: '喝盖碗茶、掏耳朵，体验成都慢生活。' },
      { name: '春熙路·太古里', category: 'shopping', categories: ['shopping', 'city', 'photo'], purposes: ['shopping', 'photo'], cost: 0, hours: 3, description: '时尚商圈与潮流打卡地。' },
      { name: '地道川菜/火锅', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 120, hours: 2, description: '麻辣鲜香的川味盛宴。' },
      { name: '成都博物馆', category: 'history', categories: ['history'], purposes: ['culture'], cost: 0, hours: 3, description: '了解巴蜀文明与成都历史。' },
      { name: '东郊记忆', category: 'photo', categories: ['photo', 'city'], purposes: ['photo', 'relax'], cost: 0, hours: 2, description: '工业风文创园区，出片率极高。' }
    ]
  },
  {
    id: 'beijing',
    name: '北京',
    region: '北京 · 中国',
    intro: '古都底蕴与现代繁华交融的文化中心。',
    dailyTransport: 50,
    tips: ['故宫和热门博物馆需提前预约，注意放票时间。', '长城距离市区较远，建议预留一整天。', '烤鸭店热门门店建议提前取号。'],
    climate: {
      avgHigh: [2, 6, 13, 21, 27, 31, 31, 30, 26, 19, 10, 4],
      avgLow: [-8, -5, 0, 7, 13, 18, 22, 21, 15, 8, 0, -6],
      rainyMonths: [7, 8],
      bestMonths: [4, 5, 9, 10],
      note: '春秋短暂而宜人，但昼夜温差大；夏季炎热多雨，冬季干冷有风。'
    },
    attractions: [
      { name: '故宫博物院', category: 'history', categories: ['history', 'photo'], purposes: ['culture', 'photo'], cost: 60, hours: 4, description: '明清皇家宫殿，穿越六百年的历史。' },
      { name: '八达岭长城', category: 'history', categories: ['history', 'nature', 'adventure'], purposes: ['adventure', 'culture'], cost: 40, hours: 5, description: '登高望远，感受"不到长城非好汉"。' },
      { name: '颐和园', category: 'nature', categories: ['nature', 'history'], purposes: ['relax', 'culture'], cost: 30, hours: 3, description: '皇家园林，湖光山色美不胜收。' },
      { name: '天坛公园', category: 'history', categories: ['history', 'relax'], purposes: ['culture', 'relax'], cost: 15, hours: 2, description: '古代祭天建筑群，庄严肃穆。' },
      { name: '南锣鼓巷', category: 'city', categories: ['city', 'food'], purposes: ['foodie', 'relax'], cost: 0, hours: 2, description: '胡同文化与潮流小店、小吃。' },
      { name: '什刹海', category: 'relax', categories: ['relax', 'city', 'photo'], purposes: ['relax', 'photo'], cost: 0, hours: 2, description: '湖边漫步、酒吧街与老北京风情。' },
      { name: '798艺术区', category: 'photo', categories: ['photo', 'city'], purposes: ['photo', 'culture'], cost: 0, hours: 3, description: '老厂房改造的当代艺术聚集地。' },
      { name: '北京烤鸭', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 150, hours: 2, description: '皮脆肉嫩的京味经典。' },
      { name: '环球影城', category: 'amusement', categories: ['amusement'], purposes: ['family', 'adventure'], cost: 418, hours: 6, description: '电影主题乐园，亲子与刺激兼得。' },
      { name: '景山公园', category: 'photo', categories: ['photo', 'nature'], purposes: ['photo', 'relax'], cost: 2, hours: 2, description: '俯瞰故宫全景的最佳机位。' }
    ]
  },
  {
    id: 'shanghai',
    name: '上海',
    region: '上海 · 中国',
    intro: '摩登都市的繁华与海派风情。',
    dailyTransport: 50,
    tips: ['外滩夜景与陆家嘴是经典机位，傍晚去最佳。', '迪士尼建议提前购票并下载官方App看排队时间。', '武康路、安福路适合骑行慢逛。'],
    climate: {
      avgHigh: [8, 10, 14, 20, 25, 28, 32, 32, 28, 23, 17, 11],
      avgLow: [1, 3, 6, 11, 16, 21, 25, 25, 21, 15, 9, 3],
      rainyMonths: [6, 7, 8],
      bestMonths: [3, 4, 5, 10, 11],
      note: '春秋舒适适合漫步；梅雨季（6月）潮湿多雨，夏季闷热，冬季湿冷。'
    },
    attractions: [
      { name: '外滩', category: 'city', categories: ['city', 'photo'], purposes: ['photo', 'romance'], cost: 0, hours: 2, description: '万国建筑与对岸天际线同框。' },
      { name: '上海博物馆', category: 'history', categories: ['history'], purposes: ['culture'], cost: 0, hours: 3, description: '馆藏丰富的艺术与历史宝库。' },
      { name: '豫园·城隍庙', category: 'history', categories: ['history', 'food'], purposes: ['culture', 'foodie'], cost: 30, hours: 3, description: '江南园林与老城厢小吃。' },
      { name: '上海迪士尼乐园', category: 'amusement', categories: ['amusement'], purposes: ['family', 'romance', 'adventure'], cost: 475, hours: 8, description: '梦幻童话世界，大人小孩都爱。' },
      { name: '田子坊', category: 'photo', categories: ['photo', 'city', 'food'], purposes: ['photo', 'relax'], cost: 0, hours: 2, description: '弄堂里的文创小店与咖啡馆。' },
      { name: '武康路', category: 'photo', categories: ['photo', 'city'], purposes: ['photo', 'relax'], cost: 0, hours: 2, description: '梧桐树下的老洋房与网红店。' },
      { name: '陆家嘴·登高观光', category: 'city', categories: ['city', 'photo'], purposes: ['photo', 'romance'], cost: 180, hours: 2, description: '登上海之巅，俯瞰魔都全景。' },
      { name: '本帮菜', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 100, hours: 2, description: '浓油赤酱的海派味道。' },
      { name: '朱家角古镇', category: 'history', categories: ['history', 'relax'], purposes: ['relax', 'culture'], cost: 0, hours: 4, description: '水乡古镇，小桥流水人家。' },
      { name: '世博公园', category: 'relax', categories: ['relax', 'nature'], purposes: ['relax', 'family'], cost: 0, hours: 2, description: '滨江绿地，适合散步放风。' }
    ]
  },
  {
    id: 'sanya',
    name: '三亚',
    region: '海南 · 中国',
    intro: '热带海滨度假胜地，阳光沙滩与浪漫。',
    dailyTransport: 60,
    tips: ['防晒和防蚊是必需品，海边紫外线强。', '蜈支洲岛等离岛建议提前订船票。', '免税城购物需留意离岛提货规则。'],
    climate: {
      avgHigh: [26, 27, 29, 31, 32, 32, 33, 32, 31, 30, 29, 27],
      avgLow: [18, 19, 21, 24, 25, 26, 26, 26, 25, 24, 22, 19],
      rainyMonths: [8, 9, 10],
      bestMonths: [11, 12, 1, 2, 3, 4],
      note: '全年温暖，11月至次年4月最舒适；8-10月为台风季，出行需关注预警。'
    },
    attractions: [
      { name: '亚龙湾', category: 'beach', categories: ['beach', 'relax'], purposes: ['relax', 'romance', 'family'], cost: 0, hours: 3, description: '水清沙幼的优质海滨浴场。' },
      { name: '蜈支洲岛', category: 'beach', categories: ['beach', 'adventure'], purposes: ['adventure', 'romance'], cost: 144, hours: 6, description: '潜水与海上运动的天堂。' },
      { name: '天涯海角', category: 'photo', categories: ['photo', 'beach'], purposes: ['photo', 'romance'], cost: 68, hours: 2, description: '浪漫海岸线，情侣打卡地标。' },
      { name: '南山文化旅游区', category: 'culture', categories: ['culture', 'relax'], purposes: ['culture', 'relax'], cost: 108, hours: 4, description: '海上观音与佛教文化园。' },
      { name: '亚龙湾热带天堂森林公园', category: 'nature', categories: ['nature', 'photo'], purposes: ['photo', 'adventure'], cost: 175, hours: 4, description: '雨林栈道与《非诚勿扰》取景地。' },
      { name: '大东海', category: 'beach', categories: ['beach', 'city'], purposes: ['relax', 'family'], cost: 0, hours: 2, description: '市区旁的热闹海滩，餐饮便利。' },
      { name: '海鲜大餐', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 150, hours: 2, description: '现捞现做的热带海鲜。' },
      { name: '三亚国际免税城', category: 'shopping', categories: ['shopping'], purposes: ['shopping'], cost: 0, hours: 4, description: '离岛免税购物天堂。' },
      { name: '潜水体验', category: 'adventure', categories: ['adventure', 'beach'], purposes: ['adventure', 'romance'], cost: 380, hours: 3, description: '潜入海底看珊瑚与鱼群。' }
    ]
  },
  {
    id: 'dali',
    name: '大理',
    region: '云南 · 中国',
    intro: '风花雪月，苍山洱海间的诗意慢生活。',
    dailyTransport: 40,
    tips: ['洱海环湖适合租电动车，注意防晒。', '早晚温差大，备一件外套。', '白族民宿很有特色，建议提前预订。'],
    climate: {
      avgHigh: [16, 18, 21, 24, 26, 25, 25, 25, 24, 22, 19, 16],
      avgLow: [3, 5, 8, 11, 14, 17, 17, 17, 15, 12, 7, 3],
      rainyMonths: [6, 7, 8],
      bestMonths: [3, 4, 5, 9, 10, 11],
      note: '四季如春，但紫外线强、昼夜温差大；雨季集中在6-8月。'
    },
    attractions: [
      { name: '洱海', category: 'nature', categories: ['nature', 'photo', 'relax'], purposes: ['relax', 'photo', 'romance'], cost: 0, hours: 3, description: '高原湖泊，环湖风光如画。' },
      { name: '大理古城', category: 'history', categories: ['history', 'city'], purposes: ['culture', 'relax'], cost: 0, hours: 3, description: '青石板路上的南诏古韵。' },
      { name: '苍山', category: 'nature', categories: ['nature', 'adventure'], purposes: ['adventure', 'photo'], cost: 120, hours: 5, description: '缆车登高，俯瞰洱海与古城。' },
      { name: '喜洲古镇', category: 'history', categories: ['history', 'photo'], purposes: ['culture', 'photo'], cost: 0, hours: 2, description: '白族民居与金色稻田。' },
      { name: '双廊', category: 'relax', categories: ['relax', 'photo'], purposes: ['relax', 'romance', 'photo'], cost: 0, hours: 3, description: '洱海边的度假小镇，看日落。' },
      { name: '崇圣寺三塔', category: 'history', categories: ['history', 'culture'], purposes: ['culture', 'photo'], cost: 75, hours: 2, description: '大理地标，千年佛塔。' },
      { name: '才村码头骑行', category: 'adventure', categories: ['adventure', 'nature'], purposes: ['adventure', 'relax'], cost: 30, hours: 3, description: '沿海骑行，吹风看海鸥。' },
      { name: '白族特色菜', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 80, hours: 2, description: '酸辣鱼、乳扇等地方风味。' },
      { name: '寂照庵', category: 'relax', categories: ['relax', 'photo'], purposes: ['relax', 'photo'], cost: 0, hours: 2, description: '多肉花园寺庙，禅意满满。' }
    ]
  },
  {
    id: 'lijiang',
    name: '丽江',
    region: '云南 · 中国',
    intro: '雪山古城，纳西风情的浪漫慢城。',
    dailyTransport: 45,
    tips: ['玉龙雪山海拔高，注意保暖和高反。', '古城石板路多，穿舒适的鞋。', '泸沽湖距丽江较远，建议安排两天。'],
    climate: {
      avgHigh: [14, 16, 19, 22, 24, 24, 24, 24, 23, 21, 18, 15],
      avgLow: [1, 2, 5, 8, 12, 15, 16, 15, 13, 9, 4, 1],
      rainyMonths: [6, 7, 8],
      bestMonths: [3, 4, 5, 9, 10],
      note: '干湿季分明，11月至次年5月晴朗少雨；雨季午后多阵雨，雪山能否露脸看运气。'
    },
    attractions: [
      { name: '丽江古城', category: 'history', categories: ['history', 'city'], purposes: ['culture', 'photo'], cost: 50, hours: 3, description: '世界文化遗产，纳西古韵水乡。' },
      { name: '玉龙雪山', category: 'nature', categories: ['nature', 'adventure', 'photo'], purposes: ['adventure', 'photo', 'romance'], cost: 100, hours: 6, description: '终年积雪的神山与冰川公园。' },
      { name: '束河古镇', category: 'history', categories: ['history', 'relax'], purposes: ['relax', 'culture'], cost: 30, hours: 3, description: '比大研更安静的茶马古镇。' },
      { name: '泸沽湖', category: 'nature', categories: ['nature', 'photo', 'relax'], purposes: ['photo', 'relax', 'romance'], cost: 70, hours: 8, description: '高原明珠，摩梭人的女儿国。' },
      { name: '蓝月谷', category: 'nature', categories: ['nature', 'photo'], purposes: ['photo', 'romance'], cost: 0, hours: 2, description: '雪山脚下的蓝色梦幻湖谷。' },
      { name: '木府', category: 'history', categories: ['history', 'culture'], purposes: ['culture'], cost: 40, hours: 2, description: '丽江土司的宫殿，北有故宫南有木府。' },
      { name: '纳西族美食', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 80, hours: 2, description: '腊排骨、鸡豆凉粉等地道风味。' },
      { name: '拉市海', category: 'nature', categories: ['nature', 'adventure'], purposes: ['adventure', 'photo'], cost: 60, hours: 4, description: '骑马划船，湿地候鸟家园。' },
      { name: '大研花巷', category: 'photo', categories: ['photo', 'city'], purposes: ['photo', 'relax'], cost: 0, hours: 2, description: '网红街区与文艺小店。' }
    ]
  },
  {
    id: 'xian',
    name: '西安',
    region: '陕西 · 中国',
    intro: '十三朝古都，厚重的历史与烟火美食。',
    dailyTransport: 40,
    tips: ['兵马俑距市区较远，可乘旅游专线。', '陕西历史博物馆需提前预约。', '回民街美食选择多，注意看口碑。'],
    climate: {
      avgHigh: [5, 9, 14, 21, 27, 32, 33, 31, 26, 20, 12, 6],
      avgLow: [-4, -1, 4, 10, 15, 20, 23, 22, 17, 11, 3, -3],
      rainyMonths: [7, 8, 9],
      bestMonths: [4, 5, 9, 10],
      note: '春秋最宜游览；夏季炎热，冬季干冷，秋季连阴雨较多。'
    },
    attractions: [
      { name: '秦始皇兵马俑', category: 'history', categories: ['history'], purposes: ['culture'], cost: 120, hours: 4, description: '世界第八大奇迹，震撼的地下军团。' },
      { name: '大雁塔', category: 'history', categories: ['history', 'culture'], purposes: ['culture', 'photo'], cost: 50, hours: 2, description: '玄奘译经之地，古都地标。' },
      { name: '陕西历史博物馆', category: 'history', categories: ['history', 'culture'], purposes: ['culture'], cost: 0, hours: 3, description: '华夏文明宝库，馆藏丰富。' },
      { name: '回民街', category: 'food', categories: ['food', 'city'], purposes: ['foodie'], cost: 0, hours: 2, description: '西安美食聚集地，小吃琳琅满目。' },
      { name: '西安城墙', category: 'history', categories: ['history', 'photo'], purposes: ['culture', 'photo'], cost: 54, hours: 3, description: '骑行城墙，俯瞰古城风光。' },
      { name: '华清宫', category: 'history', categories: ['history', 'culture'], purposes: ['culture', 'romance'], cost: 120, hours: 3, description: '唐代皇家温泉与长恨歌。' },
      { name: '大唐不夜城', category: 'city', categories: ['city', 'photo', 'food'], purposes: ['photo', 'foodie', 'romance'], cost: 0, hours: 3, description: '灯火辉煌的唐风步行街。' },
      { name: '肉夹馍·凉皮', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 30, hours: 1, description: '三秦套餐，碳水天堂。' },
      { name: '华山', category: 'nature', categories: ['nature', 'adventure'], purposes: ['adventure', 'photo'], cost: 160, hours: 8, description: '奇险天下第一山。' },
      { name: '大唐芙蓉园', category: 'culture', categories: ['culture', 'photo'], purposes: ['culture', 'photo'], cost: 120, hours: 3, description: '盛唐皇家园林主题公园。' }
    ]
  },
  {
    id: 'hangzhou',
    name: '杭州',
    region: '浙江 · 中国',
    intro: '人间天堂，西湖烟雨与江南诗意。',
    dailyTransport: 40,
    tips: ['西湖很大，骑行+游船是最佳组合。', '灵隐寺需购飞来峰门票，建议早去。', '龙井村春茶季最值得体验。'],
    climate: {
      avgHigh: [8, 10, 15, 21, 26, 29, 34, 33, 28, 23, 17, 11],
      avgLow: [1, 3, 7, 12, 17, 21, 25, 25, 20, 15, 9, 3],
      rainyMonths: [6, 7, 8],
      bestMonths: [3, 4, 5, 10, 11],
      note: '春季赏花、秋季赏桂最佳；梅雨与台风季（6-9月）降水集中。'
    },
    attractions: [
      { name: '西湖', category: 'nature', categories: ['nature', 'relax', 'photo'], purposes: ['relax', 'photo', 'romance'], cost: 0, hours: 4, description: '淡妆浓抹总相宜的江南名湖。' },
      { name: '灵隐寺', category: 'culture', categories: ['culture', 'history'], purposes: ['culture', 'relax'], cost: 45, hours: 3, description: '千年古刹，禅意清幽。' },
      { name: '雷峰塔', category: 'history', categories: ['history', 'photo'], purposes: ['culture', 'photo'], cost: 40, hours: 2, description: '白娘子传说地，登塔观湖。' },
      { name: '龙井村', category: 'nature', categories: ['nature', 'food'], purposes: ['relax', 'foodie'], cost: 0, hours: 3, description: '茶园漫步，品明前龙井。' },
      { name: '河坊街', category: 'food', categories: ['food', 'city'], purposes: ['foodie', 'shopping'], cost: 0, hours: 2, description: '杭州老字号与特色小吃。' },
      { name: '西溪湿地', category: 'nature', categories: ['nature', 'relax'], purposes: ['relax', 'photo'], cost: 80, hours: 4, description: '城市湿地，乘船穿行芦苇荡。' },
      { name: '宋城', category: 'amusement', categories: ['amusement', 'culture'], purposes: ['family', 'culture'], cost: 300, hours: 4, description: '宋文化主题乐园与千古情演出。' },
      { name: '京杭大运河夜游', category: 'city', categories: ['city', 'photo'], purposes: ['photo', 'romance'], cost: 100, hours: 2, description: '乘船夜游千年运河。' },
      { name: '杭帮菜', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 100, hours: 2, description: '西湖醋鱼、东坡肉等经典。' },
      { name: '九溪烟树', category: 'nature', categories: ['nature', 'photo'], purposes: ['photo', 'relax'], cost: 0, hours: 2, description: '溪水茶园间的清幽徒步道。' }
    ]
  },
  {
    id: 'chongqing',
    name: '重庆',
    region: '重庆 · 中国',
    intro: '8D魔幻山城，麻辣火锅与夜景。',
    dailyTransport: 40,
    tips: ['山城多坡道，穿舒适的鞋，善用轻轨。', '洪崖洞夜景人多，建议傍晚前到。', '火锅选本地人多的店更地道。'],
    climate: {
      avgHigh: [10, 13, 18, 23, 27, 30, 34, 34, 29, 22, 17, 12],
      avgLow: [6, 8, 12, 16, 20, 23, 26, 26, 22, 17, 12, 8],
      rainyMonths: [5, 6, 9, 10],
      bestMonths: [3, 4, 5, 10, 11],
      note: '春秋最舒适；夏季酷热，是著名的「火炉」，冬季多雾少雪。'
    },
    attractions: [
      { name: '洪崖洞', category: 'photo', categories: ['photo', 'city', 'food'], purposes: ['photo', 'foodie'], cost: 0, hours: 2, description: '千与千寻同款吊脚楼夜景。' },
      { name: '解放碑·八一好吃街', category: 'food', categories: ['food', 'city', 'shopping'], purposes: ['foodie', 'shopping'], cost: 0, hours: 2, description: '商圈与重庆小吃集中地。' },
      { name: '长江索道', category: 'city', categories: ['city', 'photo'], purposes: ['photo', 'adventure'], cost: 20, hours: 1, description: '空中跨越长江的山城交通。' },
      { name: '磁器口古镇', category: 'history', categories: ['history', 'food'], purposes: ['culture', 'foodie'], cost: 0, hours: 2, description: '嘉陵江畔的千年古镇。' },
      { name: '武隆天坑', category: 'nature', categories: ['nature', 'adventure'], purposes: ['adventure', 'photo'], cost: 125, hours: 6, description: '喀斯特地貌，《变形金刚》取景地。' },
      { name: '南山一棵树', category: 'photo', categories: ['photo', 'city'], purposes: ['photo', 'romance'], cost: 20, hours: 1, description: '俯瞰山城夜景的最佳观景台。' },
      { name: '重庆火锅', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 100, hours: 2, description: '麻辣鲜香，越吃越上瘾。' },
      { name: '鹅岭二厂', category: 'photo', categories: ['photo', 'city'], purposes: ['photo', 'relax'], cost: 0, hours: 2, description: '老厂房改造的文创打卡地。' },
      { name: '轻轨穿楼', category: 'photo', categories: ['photo', 'city'], purposes: ['photo'], cost: 0, hours: 1, description: '李子坝轻轨穿楼的魔幻奇观。' },
      { name: '大足石刻', category: 'history', categories: ['history', 'culture'], purposes: ['culture'], cost: 115, hours: 4, description: '世界文化遗产，石窟艺术宝库。' }
    ]
  },
  {
    id: 'guangzhou',
    name: '广州',
    region: '广东 · 中国',
    intro: '食在广州，岭南风情与都市活力。',
    dailyTransport: 40,
    tips: ['早茶是广州的灵魂，建议安排一顿。', '长隆乐园较大，提前规划游玩顺序。', '珠江夜游选傍晚班次可观日落与夜景。'],
    climate: {
      avgHigh: [18, 19, 22, 26, 30, 32, 33, 33, 32, 29, 24, 20],
      avgLow: [10, 12, 15, 20, 24, 26, 26, 26, 24, 20, 15, 11],
      rainyMonths: [5, 6, 7, 8, 9],
      bestMonths: [10, 11, 12, 3, 4],
      note: '夏长冬短，10月至次年4月最舒适；5-9月高温多雨，注意台风与回南天。'
    },
    attractions: [
      { name: '广州塔', category: 'city', categories: ['city', 'photo'], purposes: ['photo', 'romance'], cost: 150, hours: 2, description: '小蛮腰，珠江畔的城市地标。' },
      { name: '沙面岛', category: 'history', categories: ['history', 'photo', 'relax'], purposes: ['photo', 'relax', 'romance'], cost: 0, hours: 2, description: '欧陆风情建筑与绿荫大道。' },
      { name: '陈家祠', category: 'history', categories: ['history', 'culture'], purposes: ['culture'], cost: 10, hours: 2, description: '岭南建筑艺术的瑰宝。' },
      { name: '上下九步行街', category: 'shopping', categories: ['shopping', 'food'], purposes: ['shopping', 'foodie'], cost: 0, hours: 3, description: '骑楼老街，购物与小吃。' },
      { name: '长隆野生动物世界', category: 'amusement', categories: ['amusement'], purposes: ['family', 'adventure'], cost: 300, hours: 6, description: '亚洲知名的野生动物园。' },
      { name: '早茶·粤菜', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 100, hours: 2, description: '虾饺、烧卖、肠粉的地道风味。' },
      { name: '珠江夜游', category: 'city', categories: ['city', 'photo', 'relax'], purposes: ['photo', 'romance'], cost: 80, hours: 2, description: '乘船欣赏珠江两岸夜景。' },
      { name: '白云山', category: 'nature', categories: ['nature', 'relax'], purposes: ['relax', 'adventure'], cost: 5, hours: 4, description: '城市绿肺，登高望远。' },
      { name: '永庆坊', category: 'photo', categories: ['photo', 'city'], purposes: ['photo', 'relax'], cost: 0, hours: 2, description: '西关老城改造的网红街区。' },
      { name: '石室圣心大教堂', category: 'history', categories: ['history', 'photo'], purposes: ['photo', 'culture'], cost: 0, hours: 1, description: '哥特式教堂，拍照圣地。' }
    ]
  },
  {
    id: 'tokyo',
    name: '东京',
    region: '日本 · 海外',
    intro: '传统与现代交织的亚洲大都会。',
    dailyTransport: 60,
    tips: ['地铁发达，购买交通卡最方便。', '热门餐厅需提前预约或错峰。', '购物记得保留小票办理免税。'],
    climate: {
      avgHigh: [10, 11, 14, 19, 23, 26, 30, 31, 27, 22, 17, 12],
      avgLow: [2, 2, 6, 11, 16, 19, 23, 24, 21, 15, 9, 4],
      rainyMonths: [6, 9, 10],
      bestMonths: [3, 4, 5, 10, 11],
      note: '春秋气候宜人，3-4月樱花、11月红叶；6月梅雨与9-10月台风需留意。'
    },
    attractions: [
      { name: '浅草寺', category: 'history', categories: ['history', 'culture'], purposes: ['culture', 'photo'], cost: 0, hours: 2, description: '东京最古老的寺院与雷门。' },
      { name: '东京塔', category: 'city', categories: ['city', 'photo'], purposes: ['photo', 'romance'], cost: 90, hours: 2, description: '俯瞰东京的城市地标。' },
      { name: '涩谷·新宿', category: 'shopping', categories: ['shopping', 'city'], purposes: ['shopping', 'photo'], cost: 0, hours: 3, description: '潮流购物与繁华街区。' },
      { name: '秋叶原', category: 'shopping', categories: ['shopping', 'photo'], purposes: ['shopping', 'photo'], cost: 0, hours: 3, description: '动漫与电器的圣地。' },
      { name: '上野公园', category: 'nature', categories: ['nature', 'relax'], purposes: ['relax', 'family'], cost: 0, hours: 2, description: '樱花名所与博物馆群。' },
      { name: '东京迪士尼', category: 'amusement', categories: ['amusement'], purposes: ['family', 'romance'], cost: 400, hours: 8, description: '梦幻乐园，亲子与情侣皆宜。' },
      { name: '筑地·海鲜料理', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 150, hours: 2, description: '新鲜寿司与海鲜丼。' },
      { name: '明治神宫', category: 'culture', categories: ['culture', 'nature'], purposes: ['culture', 'relax'], cost: 0, hours: 2, description: '闹市中的幽静神社。' },
      { name: '台场', category: 'city', categories: ['city', 'photo', 'shopping'], purposes: ['photo', 'shopping'], cost: 0, hours: 3, description: '海滨新城与彩虹大桥。' },
      { name: '富士山一日游', category: 'nature', categories: ['nature', 'photo', 'adventure'], purposes: ['photo', 'adventure'], cost: 300, hours: 10, description: '远眺日本第一神山。' }
    ]
  },
  {
    id: 'bangkok',
    name: '曼谷',
    region: '泰国 · 海外',
    intro: '天使之城，庙宇、美食与市井烟火。',
    dailyTransport: 40,
    tips: ['参观寺庙注意着装，需遮肩与膝盖。', '打车建议用Grab，避免被宰。', '夜市丰富，注意饮食卫生。'],
    climate: {
      avgHigh: [32, 33, 34, 35, 34, 33, 33, 32, 32, 32, 32, 31],
      avgLow: [22, 24, 26, 27, 26, 26, 26, 26, 25, 25, 24, 22],
      rainyMonths: [5, 6, 7, 8, 9, 10],
      bestMonths: [11, 12, 1, 2],
      note: '全年炎热，11月至次年2月为凉季最舒适；5-10月雨季午后多暴雨。'
    },
    attractions: [
      { name: '大皇宫', category: 'history', categories: ['history', 'culture'], purposes: ['culture', 'photo'], cost: 100, hours: 3, description: '金碧辉煌的泰国王宫。' },
      { name: '卧佛寺', category: 'culture', categories: ['culture', 'history'], purposes: ['culture'], cost: 40, hours: 2, description: '巨大卧佛与传统泰式按摩发源地。' },
      { name: '郑王庙', category: 'history', categories: ['history', 'photo'], purposes: ['photo', 'culture'], cost: 20, hours: 2, description: '湄南河畔的黎明寺。' },
      { name: '暹罗商圈', category: 'shopping', categories: ['shopping', 'city'], purposes: ['shopping'], cost: 0, hours: 4, description: '大型购物中心与百货。' },
      { name: '恰图恰周末市集', category: 'shopping', categories: ['shopping', 'food'], purposes: ['shopping', 'foodie'], cost: 0, hours: 4, description: '亚洲最大周末市集。' },
      { name: '湄南河夜游', category: 'city', categories: ['city', 'photo', 'relax'], purposes: ['photo', 'romance'], cost: 120, hours: 2, description: '自助晚餐配河畔夜景。' },
      { name: '泰式按摩', category: 'relax', categories: ['relax'], purposes: ['relax'], cost: 100, hours: 2, description: '放松身心的经典体验。' },
      { name: '夜市小吃', category: 'food', categories: ['food'], purposes: ['foodie'], cost: 80, hours: 2, description: '芒果糯米饭、冬阴功等地道美食。' },
      { name: '水上市场', category: 'culture', categories: ['culture', 'food', 'photo'], purposes: ['photo', 'foodie'], cost: 50, hours: 4, description: '乘船逛市集的独特体验。' },
      { name: '芭堤雅海滩', category: 'beach', categories: ['beach', 'adventure'], purposes: ['relax', 'adventure'], cost: 150, hours: 6, description: '滨海度假与水上项目。' }
    ]
  }
];
