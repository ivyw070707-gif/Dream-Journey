(function (root) {
  const cities = [
    ['安吉', '浙江', 30.89, 119.68], ['大理', '云南', 25.61, 100.27], ['潮州', '广东', 23.66, 116.62], ['杨浦', '上海', 31.23, 121.47], ['阿勒泰', '新疆', 47.84, 88.14],
    ['延安', '陕西', 36.59, 109.49], ['景德镇', '江西', 29.27, 117.18], ['汕头', '广东', 23.35, 116.68], ['舟山', '浙江', 29.98, 122.21], ['丽江', '云南', 26.87, 100.23],
    ['黔东南', '贵州', 26.58, 107.98], ['龙胜', '广西', 25.79, 110.01], ['青岛', '山东', 36.07, 120.38], ['甘南', '甘肃', 34.99, 102.91], ['海口', '海南', 20.04, 110.20],
    ['拉萨', '西藏', 29.65, 91.14], ['成都', '四川', 30.67, 104.06], ['宁波', '浙江', 29.87, 121.55], ['西双版纳', '云南', 22.00, 100.80], ['哈尔滨', '黑龙江', 45.80, 126.53]
  ];
  const topics = [['社区与照护', 'community'], ['土地与生态', 'ecology'], ['文化与记忆', 'culture'], ['教育与成长', 'learning'], ['食物与地方', 'place']];
  const focuses = ['社区公共空间', '河流与湿地', '儿童阅读', '地方手艺', '老年照护', '乡村食物', '校园关系', '传统建筑', '海岸线', '迁徙记忆'];
  root.DREAM_DEMO_PROJECTS = Array.from({ length: 100 }, (_, index) => {
    const city = cities[index % cities.length];
    const topic = topics[index % topics.length];
    const focus = focuses[index % focuses.length];
    const number = index + 1;
    return {
      id: `demo-${String(number).padStart(3, '0')}`,
      title: `${city[0]}的第${(index % 5) + 1}种回答`,
      city: city[0], province: city[1],
      lat: Number((city[2] + ((index % 4) - 1.5) * 0.08).toFixed(3)),
      lng: Number((city[3] + ((index % 5) - 2) * 0.12).toFixed(3)),
      topic: topic[1], topicLabel: topic[0], focus,
      year: 2021 + (index % 5), days: 3 + (index % 2),
      children: 8 + (index % 15), communities: 1 + (index % 4),
      summary: `一支学生小队在${city[0]}围绕“${focus}”展开田野观察，用访谈、记录和共创留下了新的线索。`,
      question: '如果再来一次，我们还能和谁一起把问题看得更清楚？'
    };
  });
}(window));
