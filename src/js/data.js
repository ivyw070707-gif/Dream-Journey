export const projects = [
  {
    "id": "wooden-houses",
    "title": "The houses that remember",
    "researchQuestion": "Why are traditional wooden houses disappearing?",
    "studentName": "小雨 & the Timber Team",
    "year": 2025,
    "origin": "Longsheng, Guangxi",
    "destination": "Guizhou",
    "cn": "贵州",
    "theme": "Architecture & belonging",
    "color": "#af533d",
    "chinese": "木屋消失以后，\n记忆住在哪里？",
    "kind": "house",
    "note": "My grandmother says a house can remember. I want to find out what she means.",
    "unansweredQuestions": [
      "What happens when the last traditional carpenter retires?",
      "Do young people want these buildings preserved?",
      "Could tourism protect this tradition—or change it?"
    ]
  },
  {
    "id": "tea",
    "title": "A leaf, a whole world",
    "researchQuestion": "Can a tea leaf tell the story of a mountain?",
    "studentName": "阿宁 & the Leaf Collectors",
    "year": 2025,
    "origin": "Baoshan, Yunnan",
    "destination": "Yunnan",
    "cn": "云南",
    "theme": "Ecology & livelihoods",
    "color": "#65735c",
    "chinese": "一片茶叶，\n一座山的故事",
    "kind": "leaf",
    "note": "We see tea every day. But we have never followed one leaf all the way from the mountain to a cup.",
    "unansweredQuestions": [
      "How will a warmer climate change our tea?",
      "Who decides what a good tea tastes like?",
      "Can the youngest farmers keep the oldest trees alive?"
    ]
  },
  {
    "id": "river",
    "title": "Listening to the river",
    "researchQuestion": "Where does our river go after it leaves home?",
    "studentName": "小川 & the River Watchers",
    "year": 2025,
    "origin": "Bazhong, Sichuan",
    "destination": "Sichuan",
    "cn": "四川",
    "theme": "Water & community",
    "color": "#577b87",
    "chinese": "河流离开家乡后，\n去了哪里？",
    "kind": "river",
    "note": "The water outside our school keeps moving. We want to follow it, and listen to the people along its banks.",
    "unansweredQuestions": [
      "Who takes care of a river between two towns?",
      "What can a river tell us about its past?",
      "Can we hear the water getting healthier?"
    ]
  },
  {
    "id": "city",
    "title": "Under the same sky",
    "researchQuestion": "Is there room for birds in a city of people?",
    "studentName": "晨晨 & the Sky Observers",
    "year": 2025,
    "origin": "Jinzhai, Anhui",
    "destination": "Shanghai",
    "cn": "上海",
    "theme": "Urban nature",
    "color": "#b4884c",
    "chinese": "高楼之间，\n小鸟住在哪里？",
    "kind": "bird",
    "note": "There are nests under the roof of our school. Where do birds build their homes when the buildings are made of glass?",
    "unansweredQuestions": [
      "Do city lights change how birds sleep?",
      "What makes a building a good neighbour?",
      "Could we design a school for birds, too?"
    ]
  },
  {
    "id": "sea",
    "title": "The sea in our hands",
    "researchQuestion": "What does the tide leave behind?",
    "studentName": "小海 & the Shoreline Club",
    "year": 2025,
    "origin": "Ningdu, Jiangxi",
    "destination": "Fujian",
    "cn": "福建",
    "theme": "Ocean & material culture",
    "color": "#627c79",
    "chinese": "潮水退去以后，\n留下了什么？",
    "kind": "river",
    "note": "We have only seen the sea in books. We want to learn what we can discover by looking carefully at one small beach.",
    "unansweredQuestions": [
      "Where did this piece of plastic begin its journey?",
      "How does a beach change through the seasons?",
      "What will the next tide bring?"
    ]
  },
  {
    "id": "history",
    "title": "A city beneath our feet",
    "researchQuestion": "How many stories can one city hold?",
    "studentName": "明明 & the Time Travellers",
    "year": 2025,
    "origin": "Qingyang, Gansu",
    "destination": "Xi’an",
    "cn": "西安",
    "theme": "History & everyday life",
    "color": "#967252",
    "chinese": "脚下的城市，\n藏着多少故事？",
    "kind": "house",
    "note": "We want to learn history from people and places, not only from the dates in our textbook.",
    "unansweredQuestions": [
      "Whose stories are missing from museums?",
      "What should we keep for the next generation?",
      "Can an ordinary street become an archive?"
    ]
  },
  {
    "id": "stars",
    "title": "A little closer to the stars",
    "researchQuestion": "Why can we see more stars at home?",
    "studentName": "星星 & the Night Watch",
    "year": 2025,
    "origin": "Luanping, Hebei",
    "destination": "Beijing",
    "cn": "北京",
    "theme": "Astronomy & light",
    "color": "#6c6e90",
    "chinese": "同一片夜空，\n星星去了哪里？",
    "kind": "stars",
    "note": "My cousin in Beijing says she cannot see the Milky Way. We want to bring our night sky to her.",
    "unansweredQuestions": [
      "How dark does a night need to be?",
      "Can a city switch off a little?",
      "What else disappears when we lose the stars?"
    ]
  }
];
export const stages = ['A small curiosity','The first question','Our first assumption','Reading & research','An idea that failed','A teacher’s question','A better question','Preparing to listen','A journey takes shape','A door opens','In the field','Something unexpected','Looking back'];

// Representative destinations for these fictional journeys, in real geographic coordinates.
const coordinates = [
  [[25.81,110.01],[26.65,106.63]], [[25.12,99.16],[22.01,100.80]],
  [[31.87,106.75],[31.00,103.65]], [[31.68,115.93],[31.23,121.47]],
  [[26.47,116.02],[24.48,118.09]], [[35.73,107.64],[34.34,108.94]],
  [[40.94,117.33],[39.91,116.40]]
];
const chineseProjects = [
  {title:'会记得的木屋',researchQuestion:'传统木屋为什么正在消失？',studentName:'小雨和木屋研究队',origin:'广西龙胜',destination:'贵州',theme:'建筑与归属',note:'奶奶说，一座房子也会记得。我想知道她说的是什么意思。',unansweredQuestions:['最后一位传统木匠退休后，会发生什么？','年轻人希望这些房子被保留下来吗？','旅游能保护这项传统，还是会改变它？']},
  {title:'一片叶子，一个世界',researchQuestion:'一片茶叶，能讲述一座山的故事吗？',studentName:'阿宁和采叶小队',origin:'云南保山',destination:'云南',theme:'生态与生计',note:'我们每天都能看到茶，却从未跟随一片叶子，从山间一路走到茶杯。',unansweredQuestions:['变暖的气候，会怎样改变我们的茶？','谁来决定一杯好茶的味道？','最年轻的茶农，能守护最古老的茶树吗？']},
  {title:'听见河流的声音',researchQuestion:'河流离开家乡后，去了哪里？',studentName:'小川和河流观察队',origin:'四川巴中',destination:'四川',theme:'水与社区',note:'学校外的河水一直在流。我们想跟着它走，听听两岸的人怎么说。',unansweredQuestions:['两个小镇之间的河流，由谁来照顾？','一条河能告诉我们怎样的过去？','我们能听出河水正在变健康吗？']},
  {title:'同一片天空下',researchQuestion:'住满人的城市，还容得下小鸟吗？',studentName:'晨晨和天空观察队',origin:'安徽金寨',destination:'上海',theme:'城市里的自然',note:'学校的屋檐下有鸟巢。如果楼房都变成玻璃做的，小鸟会把家安在哪里？',unansweredQuestions:['城市的灯光，会改变小鸟的睡眠吗？','什么样的建筑，才是一个好邻居？','我们也能为小鸟设计一所学校吗？']},
  {title:'手心里的大海',researchQuestion:'潮水退去以后，留下了什么？',studentName:'小海和海岸小队',origin:'江西宁都',destination:'福建',theme:'海洋与物质文化',note:'我们只在书里见过大海。我们想仔细看看一小片海滩，那里会藏着怎样的发现？',unansweredQuestions:['这片塑料，是从哪里开始旅行的？','一片海滩，会怎样随着四季变化？','下一次涨潮，会带来什么？']},
  {title:'脚下的另一座城',researchQuestion:'一座城市，能藏下多少故事？',studentName:'明明和时光旅行队',origin:'甘肃庆阳',destination:'西安',theme:'历史与日常生活',note:'我们想从人和地方身上学历史，而不只是记住课本里的年份。',unansweredQuestions:['博物馆里，还缺少谁的故事？','我们应该为下一代留下什么？','一条普通的街道，也能成为档案馆吗？']},
  {title:'离星星更近一点',researchQuestion:'为什么在家乡，能看到更多星星？',studentName:'星星和夜空守望队',origin:'河北滦平',destination:'北京',theme:'天文与光',note:'住在北京的表姐说，她看不到银河。我们想把家乡的夜空带给她。',unansweredQuestions:['夜晚要多黑，才能看见星星？','一座城市，能不能关掉一点灯？','失去星空时，我们还失去了什么？']}
];
export const chineseStages = ['一点好奇','第一个问题','最初的猜想','阅读与查找','一次失败的想法','老师的追问','更好的问题','准备倾听','旅程渐渐成形','一扇门打开了','走进现场','意料之外的发现','回头看看'];

export function getProjects(language) {
  return projects.map((project, i) => ({
    ...project, ...(language === 'zh' ? chineseProjects[i] : {}),
    originCoords: {lat: coordinates[i][0][0], lng: coordinates[i][0][1]},
    destinationCoords: {lat: coordinates[i][1][0], lng: coordinates[i][1][1]}
  }));
}
export function getStages(language) { return language === 'zh' ? chineseStages : stages; }

export function getStageNotes(language, project) {
  return language === 'zh' ? [
    project.note,'我们把问题写在纸上。大声读出来，才听清自己真正想知道什么。',
    '我们以为自己已经知道答案，于是先把猜想写下来，等着去验证。','书本给了我们名字，人们会给我们故事。',
    '第一个计划太大了。一个更小的问题，让我们找到了起点。','“你怎么知道这是真的？你可以去问谁？”——老师的追问',
    '我们把“为什么会这样”，变成可以通过倾听和观察去探索的问题。','我们准备了五个开放式问题，然后练习不打断别人地倾听。',
    '目的地、路线和预算。我们的问题，正在变成一个真正的计划。','在这个虚构旅程里，资助让我们有机会把研究带出教室。',
    '我们仔细观察，记录前先征得同意，每天结束后再一起核对笔记。','有人给出了一个不符合我们猜想的答案。最有趣的部分，正是从这里开始。',
    '我们带着满满一本证据回来，也带回了一张新的问题清单。'
  ] : [
    project.note,'We wrote our question on paper. Saying it out loud helped us hear what we really wanted to know.',
    'We thought we already knew the answer. We wrote that assumption down so we could test it.','Books gave us the names. People would give us the stories.',
    'Our first plan was too big. A smaller question gave us a place to begin.','“How could you find out whether that is true? Who could you ask?” — teacher feedback',
    'We changed “why does this happen?” into a question we could explore by listening and observing.','We prepared five open questions, then practised listening without interrupting.',
    'A destination, a route, a budget. Our question was becoming a real plan.','In this fictional journey, sponsorship made it possible to take our research beyond the classroom.',
    'We observed carefully, asked permission before recording, and compared our notes at the end of the day.','Someone gave us an answer that did not fit our theory. That was when the most interesting part began.',
    'We returned with a notebook full of evidence—and a new list of questions.'
  ];
}
