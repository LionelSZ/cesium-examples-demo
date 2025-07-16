/**
 * 创建一个视频流并应用于Cesium多边形
 * @param {Object} options - 配置选项
 * @param {Cesium.Viewer} options.viewer - Cesium查看器实例
 * @param {string} options.m3u8Url - 视频流的m3u8链接
 * @param {number} options.centerLongitude - 中心点经度
 * @param {number} options.centerLatitude - 中心点纬度
 * @param {number} options.width - 多边形宽度(米)
 * @param {number} options.length - 多边形长度(米)
 * @param {number} options.height - 多边形高度(米)
 * @param {number} options.heading - 多边形朝向角度(度)
 * @param {number} options.pitch - 多边形俯仰角度(度)
 * @param {number} options.roll - 多边形翻滚角度(度)
 * @param {number} options.alpha - 透明度 (0-1)
 * @returns {Object} 包含视频元素和多边形实体的对象
 */
function createVideoPolygon(options) {
  const {
    viewer,
    m3u8Url,
    centerLongitude,
    centerLatitude,
    width = 2000,
    length = 1000,
    height = 1000,
    heading = 0,
    pitch = 0,
    roll = 0,
    alpha = 1
  } = options;

  if (!viewer || !m3u8Url || centerLongitude === undefined || centerLatitude === undefined) {
    console.error('缺少必要参数');
    return null;
  }

  // 创建视频元素
  const video = document.createElement('video');
  video.controls = false; // 不显示控制条
  video.muted = true; // 静音播放
  video.preload = 'metadata';
  video.loop = true; // 循环播放
  video.style.display = 'none'; // 隐藏视频元素
  document.body.appendChild(video);

  // 计算旋转后的坐标
  const centerPosition = Cesium.Cartographic.fromDegrees(centerLongitude, centerLatitude);
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const headingRadians = Cesium.Math.toRadians(heading);

  // 创建围绕中心点的四个角
  const positions = [];
  const cornerOffsets = [
    { x: -halfWidth, y: -halfLength, z: 0 }, // 左下
    { x: halfWidth, y: -halfLength, z: 0 },  // 右下
    { x: halfWidth, y: halfLength, z: height }, // 右上
    { x: -halfWidth, y: halfLength, z: height }  // 左上
  ];

  // 应用旋转
  cornerOffsets.forEach(offset => {
    // 旋转点
    const rotatedX = offset.x * Math.cos(headingRadians) - offset.y * Math.sin(headingRadians);
    const rotatedY = offset.x * Math.sin(headingRadians) + offset.y * Math.cos(headingRadians);

    // 转换为地理坐标
    const point = Cesium.Cartesian3.fromRadians(
      centerPosition.longitude + rotatedX / Cesium.Ellipsoid.WGS84.maximumRadius,
      centerPosition.latitude + rotatedY / Cesium.Ellipsoid.WGS84.maximumRadius,
      offset.z
    );
    positions.push(point);
  });

  // 加载视频流
  initHLS(m3u8Url, video).then(() => {
    // 检查 video 是否尺寸准备就绪
    function isVideoReady(video) {
      return (
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      );
    }

    function createPolygonWhenReady() {
      if (!isVideoReady(video)) {
        requestAnimationFrame(createPolygonWhenReady);
        return;
      }

      const polygon = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: new Cesium.ImageMaterialProperty({
            image: video,
            transparent: true,
            color: Cesium.Color.WHITE.withAlpha(alpha)
          }),
          perPositionHeight: true
        }
      });

      console.log("视频材质已应用");
    }

    requestAnimationFrame(createPolygonWhenReady);
  }).catch(error => {
    console.error('视频加载失败:', error);
    document.body.removeChild(video);
    return null;
  });

  // 初始化HLS视频
  function initHLS(m3u8Url, video) {
    return new Promise((resolve, reject) => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: true,
        });

        // 加载视频源
        hls.loadSource(m3u8Url);
        hls.attachMedia(video);

        // 监听清单解析完成事件
        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
          // 尝试自动播放
          // debugger
          // hls.currentLevel = 3;
          hls.currentLevel = hls.levels.length - 1;
          hls.autoLevelEnabled = false;

          video.play().catch(function (error) {
            console.warn("自动播放失败，可能需要用户交互:", error);
          });
          resolve(hls);
        });


        // 监听错误事件
        hls.on(Hls.Events.ERROR, function (event, data) {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('网络错误：无法加载视频流');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('媒体错误：视频解码失败');
                hls.recoverMediaError();
                break;
              default:
                console.error('致命错误:', data.details);
                hls.destroy();
                reject(new Error(`HLS致命错误: ${data.details}`));
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari 原生支持 HLS
        video.src = m3u8Url;
        video.addEventListener('loadedmetadata', function () {
          video.play().catch(error => console.warn("自动播放失败:", error));
          resolve();
        });
        video.addEventListener('error', function (e) {
          reject(new Error('Safari视频加载失败'));
        });
      } else {
        reject(new Error('浏览器不支持HLS播放'));
      }
    });
  }
}
