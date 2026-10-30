// Only the supplied covers, cover titles and confirmed destinations are populated.
// Add each journey's content to its own definition; empty fields are hidden in the UI.
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
    id: 'tulou', title: {zh: '土楼研学报告', en: 'Tulou Study Journey'},
    cover: 'assets/images/journeys/tulou.png',
    destination: {zh: '漳州', en: 'Zhangzhou'},
    destinationCoords: {lat: 24.513, lng: 117.647}, color: '#af533d'
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
  })
];

export const stages = ['A small curiosity','The first question','Our first assumption','Reading & research','An idea that failed','A teacher’s question','A better question','Preparing to listen','A journey takes shape','A door opens','In the field','Something unexpected','Looking back'];
export const chineseStages = ['一点好奇','第一个问题','最初的猜想','阅读与查找','一次失败的想法','老师的追问','更好的问题','准备倾听','旅程渐渐成形','一扇门打开了','走进现场','意料之外的发现','回头看看'];
export function getProjects(language, published = []) {
  return [...projects, ...published].map(project => localizeProject(project, language));
}
export function getStages(language) { return language === 'zh' ? chineseStages : stages; }
export function getStageNotes(language, project) { return project.researchNotes; }
