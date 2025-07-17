let myVideoPolygon = null
function getCurrentCameraInfo() {
  const camera = viewer.camera;
  const position = camera.position;

  // 将相机位置从笛卡尔坐标转为地理坐标（经纬度、高度）
  const cartographic = Cesium.Cartographic.fromCartesian(position);

  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const height = cartographic.height;

  // 获取相机的方向（heading, pitch, roll）
  const orientation = {
    heading: Cesium.Math.toDegrees(camera.heading),
    pitch: Cesium.Math.toDegrees(camera.pitch),
    roll: Cesium.Math.toDegrees(camera.roll)
  };

  return {
    position: {
      longitude: longitude,
      latitude: latitude,
      height: height
    },
    orientation: orientation
  };
}



// 飞行到北京
function flyToBeijing() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.4074, 39.9042, 50000),
    duration: 3.0
  });
}

// 飞行到上海
function flyToShanghai() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(121.4737, 31.2304, 50000),
    duration: 3.0
  });
}

// 回到全球视图
function flyToWorld() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 15000000),
    duration: 3.0
  });
}
function flyToVideo() {
  const { position, orientation } = SH_JD;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height),
    duration: 3.0,
    orientation: {
      heading: Cesium.Math.toRadians(orientation.heading),
      pitch: Cesium.Math.toRadians(orientation.pitch),
      roll: Cesium.Math.toRadians(orientation.roll)
    },
    complete: function () {
      console.log('相机到达指定位置');
      createVideo()
    }
  });
}

const createVideo = () => {
  const videoOptions = {
    m3u8Url: 'https://rvsh.jtw.sh.gov.cn/live/fd66e517-9577-417b-b3ca-6027d9308e3f_sub/index.m3u8?t=1910334461&k=ba15eb28db98cb1b',
    positions: [
      121.378925, 31.249906,
      121.379064, 31.250273,
      121.380046, 31.249988,
      121.380436, 31.249878,
      121.380431, 31.249687,
      121.380388, 31.249528,
      121.380360, 31.249447,
      121.379655, 31.249666,
    ],
    clampToGround: true,
    alpha: 0.8
  }
  myVideoPolygon = new VideoPolygon(viewer, videoOptions);
}

function changePolygon(entity = myVideoPolygon || null) {
  if (!entity) throw new Error('entity is not defined')
  entity.updatePositions([
    121.509020, 31.034731,
    121.509397, 31.034946,
    121.509411, 31.034226,
    121.509066, 31.034208
  ])
}
function closeVideo(entity = myVideoPolygon || null) {
  if (!entity) throw new Error('entity is not defined')
  entity.destroy()
}
// 根据 polygonEntity 坐标信息 计算出horizontal、vertical 长度 米为单位
function getDistance(polygonEntity) {
  debugger
  const positions = polygonEntity.polygon.hierarchy;
  const horizontal = Cesium.Cartesian3.distance(positions[0], positions[1]);
  const vertical = Cesium.Cartesian3.distance(positions[0], positions[2]);
  console.log({ horizontal, vertical });
  return { horizontal, vertical }
}



// event function
// 鼠标位置和高度显示
