// Only supplied materials and confirmed destinations are populated; empty fields stay hidden.
import {localizeProject} from './project-schema.js';
const emptyText = () => ({zh: '', en: ''});
function journey(definition) {
  return {
    researchQuestion: emptyText(), studentName: emptyText(), origin: emptyText(),
    theme: emptyText(), note: emptyText(), year: null,
    researchNotes: Array(13).fill(null),
    transport: emptyText(), fieldPhotos: [], fieldNotes: emptyText(),
    finalOutcomes: [null, null, null], model: null, unansweredQuestions: [],
    ...definition
  };
}

export const projects = [
  journey({
    id: 'tulou', title: {zh: '一楼一世界：福建土楼研学', en: 'One Building, One World: A Fujian Tulou Study'}, featured: true,
    cover: 'assets/images/journeys/tulou-exhibition.png',
    destination: {zh: '漳州', en: 'Zhangzhou'}, destinationCoords: {lat: 24.513, lng: 117.647},
    origin: {zh: '厦门', en: 'Xiamen'}, originCoords: {lat: 24.480, lng: 118.089}, color: '#af533d',
    studentName: {zh: '大鱼海棠小队', en: 'Big Fish & Begonia Team'},
    theme: {zh: '福建土楼的建筑智慧与楼里生活', en: 'The architecture and everyday life of Fujian Tulou'}, year: 2026,
    researchQuestion: {
      zh: '土楼的墙只是用生土一层层夯出来的，为什么不怕风吹雨打、不怕火、还能抗地震，几百年不倒？整座楼为什么只开一门，窗户为什么只从三层往上开？',
      en: 'Why have rammed-earth Tulou walls withstood centuries of wind, rain, fire and earthquakes, and why do the buildings have one entrance with windows only on the upper floors?'
    },
    note: {
      zh: '从二月地理图册上的一张照片，到八月末的一张手抄报，这是我们和“大鱼海棠小队”的伙伴把“去福建看一座土楼是怎么站了几百年”这件事，从想法变成现实的完整时间线。',
      en: 'From an atlas photograph in February to a handmade report at the end of August, this is how our question about Fujian Tulou became a journey.'
    },
    researchNotes: [
      {zh: '二月，我在地理图册上看到福建土楼的航拍照片。群山之间黑瓦黄墙的圆形大楼让我好奇：这么大一圈房子，居然全是用土夯出来的？', en: 'An aerial photograph in a geography atlas sparked our curiosity about these enormous circular rammed-earth homes.'},
      {zh: '四月的小组讨论把兴趣变成正式问题：土墙为什么能经受风雨和地震？为什么整座楼只开一门，窗户只从三层往上开？', en: 'In April, the team turned its curiosity into questions about the walls, single entrance and upper-floor windows.'},
      null,
      {zh: '五月完成《圆圆的土楼，暖暖的家——福建土楼研学提案》，包含研究目标、四天三夜行程、采访与观察方法、预期成果、安全和预算方案。', en: 'In May, we completed a proposal covering goals, a four-day itinerary, field methods, expected outcomes, safety and budget.'},
      null, null,
      {zh: '提案在学校评审会上通过。老师评价：“问题有探究味，行程有安全也有深度。”', en: 'The school approved the proposal, recognizing both its investigative question and its thoughtful, safe itinerary.'},
      {zh: '正式组队并分工：采访和记录、拍照与资料整理、财务与安全。完成民宿、体验课和车票预约。', en: 'The team divided responsibility for interviews, records, photography, research, finance and safety, then completed all bookings.'},
      {zh: '行程确定为：田螺坑与裕昌楼、塔下村居民和老匠人采访、夯土与黏土模型体验、整理资料并返程。', en: 'The itinerary combined Tianluokeng, Yuchanglou, Taxia Village, resident and craftsperson interviews, rammed-earth practice and model making.'},
      {zh: '8月22日住进塔下村一座仍有人家的圆楼，采访居民与夯土老匠人，四月的问题在现场得到答案。', en: 'Staying in an inhabited round building in Taxia Village allowed us to interview residents and a craftsperson and answer our original questions.'},
      {zh: '老匠人介绍“三合土”配方、糯米浆和红糖水、竹木“墙骨”，以及墙脚厚、墙顶薄的夯筑方法；一门和高窗则用于防匪防盗。', en: 'A craftsperson explained the earth mixture, organic additives, bamboo and timber reinforcement, tapered walls, and the defensive entrance and windows.'},
      {zh: '8月23日轮流举夯锤体验夯土，又制作黏土小圆楼和画有瓦顶、红灯笼的圆书签。', en: 'We tried ramming earth with wooden moulds, then made clay Tulou models and illustrated round bookmarks.'},
      {zh: '8月31日完成《一楼一世界——福建土楼》手抄报，用“我们的问题”“土墙的秘密”“楼里人家”“我们的小土楼”整理研学收获。', en: 'We finished a handmade report presenting our questions, the wall construction, life inside Tulou and our models.'}
    ],
    fieldPhotos: [
      {src: 'assets/images/journeys/tulou-crafts.jpg', alt: {zh: '土楼主题手工艺品与黏土模型', en: 'Tulou-themed crafts and clay models'}, caption: {zh: '动手体验后完成的土楼模型、圆书签与手工艺品。', en: 'Tulou models, bookmarks and crafts made during the workshop.'}},
      {src: 'assets/images/journeys/tulou-models.jpg', alt: {zh: '大鱼海棠小队制作的黏土土楼', en: 'Clay Tulou made by the team'}, caption: {zh: '把实地观察到的圆楼结构，变成自己的黏土作品。', en: 'Observations of circular Tulou translated into clay models.'}}
    ],
    fieldNotes: {
      zh: '8月21日到南靖，在观景台看田螺坑“四菜一汤”，下午走进裕昌楼。22日住进塔下村圆楼，采访居民与老匠人，弄清三合土、墙骨、厚墙脚和一门高窗的作用。23日用木模体验夯土，制作黏土土楼与圆书签。24日整理采访录音和照片，补查世界遗产资料，傍晚返程。',
      en: 'Across four days in Nanjing, the team visited Tianluokeng and Yuchanglou, stayed in Taxia Village, interviewed residents and a craftsperson, practised rammed-earth construction, made models, and organized recordings, photographs and further research.'
    },
    finalOutcomes: [
      {src: 'assets/documents/tulou-research-timeline.docx', name: '福建土楼研学规划时间线.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', caption: {zh: '从提出问题到完成手抄报的完整研学时间线。', en: 'The complete study timeline from the first question to the final handmade report.'}},
      null, null
    ],
    model: {
      src: 'assets/models/tulou-village.glb', name: '土楼手工作品.glb', mime: 'model/gltf-binary',
      caption: {
        zh: '土楼手工作品的三维模型，保留四座小圆楼、小桥、河流与庭院摆件。拖动模型可从不同角度观察。',
        en: 'A 3D reconstruction of the handmade Tulou scene, with four round buildings, a bridge, a river and courtyard details. Drag to explore it from different angles.'
      }
    },
    unansweredQuestions: [{zh: '现在还有年轻人愿意住在土楼里吗？', en: 'Do young people still choose to live in Tulou today?'}]
  }),
  journey({
    id: 'suzhou', title: {zh: '苏州研学之旅', en: 'A Study Journey to Suzhou'},
    cover: 'assets/images/journeys/suzhou.png',
    destination: {zh: '苏州', en: 'Suzhou'},
    destinationCoords: {lat: 31.299, lng: 120.585}, color: '#577b87'
  }),
  journey({
    id: 'dunhuang', title: {zh: '敦煌文化', en: 'The Culture of Dunhuang'},
    cover: 'assets/images/journeys/dunhuang.png',
    destination: {zh: '敦煌', en: 'Dunhuang'},
    destinationCoords: {lat: 40.142, lng: 94.662}, color: '#b4884c'
  }),
  journey({
    id: 'miao-interview', title: {zh: '苗族文化采访记录', en: 'Miao Culture Interview Notes'},
    cover: 'assets/images/journeys/miao-interview.png',
    destination: {zh: '贵阳', en: 'Guiyang'},
    destinationCoords: {lat: 26.647, lng: 106.630}, color: '#65735c'
  }),
  journey({
    id: 'tulou-journal', title: {zh: '大鱼海棠小队研学日记', en: 'Big Fish & Begonia Team Study Journal'},
    cover: 'assets/images/journeys/tulou-journal.png',
    origin: {zh: '杭州', en: 'Hangzhou'}, originCoords: {lat: 30.274, lng: 120.155},
    destination: {zh: '漳州', en: 'Zhangzhou'}, destinationCoords: {lat: 24.513, lng: 117.647}, color: '#b06c52'
  }),
  journey({
    id: 'tulou-field-notes', title: {zh: '土楼研学观察笔记', en: 'Tulou Study Observation Notes'},
    cover: 'assets/images/journeys/tulou-field-notes.png',
    origin: {zh: '南昌', en: 'Nanchang'}, originCoords: {lat: 28.682, lng: 115.858},
    destination: {zh: '漳州', en: 'Zhangzhou'}, destinationCoords: {lat: 24.513, lng: 117.647}, color: '#78845e'
  }),
  journey({
    id: 'tulou-report', title: {zh: '土楼研学报告', en: 'Tulou Study Report'},
    cover: 'assets/images/journeys/tulou.png',
    origin: {zh: '长沙', en: 'Changsha'}, originCoords: {lat: 28.228, lng: 112.939},
    destination: {zh: '漳州', en: 'Zhangzhou'}, destinationCoords: {lat: 24.513, lng: 117.647}, color: '#a68a56'
  })
];

export const stages = ['A small curiosity','The first question','Our first assumption','Reading & research','An idea that failed','A teacher’s question','A better question','Preparing to listen','A journey takes shape','A door opens','In the field','Something unexpected','Looking back'];
export const chineseStages = ['一点好奇','第一个问题','最初的猜想','阅读与查找','一次失败的想法','老师的追问','更好的问题','准备倾听','旅程渐渐成形','一扇门打开了','走进现场','意料之外的发现','回头看看'];
export function getProjects(language, published = []) {
  return [...projects, ...published].map(project => localizeProject(project, language));
}
export function getStages(language) { return language === 'zh' ? chineseStages : stages; }
export function getStageNotes(language, project) { return project.researchNotes; }
