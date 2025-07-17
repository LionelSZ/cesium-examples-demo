// import * as Cesium from 'cesium';
// import Hls from 'hls.js';

class VideoPolygon {
  /**
   * 构造函数：创建一个新的视频多边形实例。
   * @param {Cesium.Viewer} viewer Cesium Viewer 实例。
   * @param {object} options 配置选项。
   * @param {string} options.m3u8Url HLS 视频流的 URL。
   * @param {Cesium.Cartesian3[] | number[]} options.positions 多边形的点位数组。
   * @param {number} [options.alpha=1] 多边形的透明度。
   * @param {boolean} [options.loop=true] 视频是否循环播放。
   * @param {boolean} [options.clampToGround=false] 多边形是否贴地。
   */
  constructor(viewer, options) {
    if (!viewer || !options || !options.m3u8Url || !options.positions || options.positions.length < 3) {
      throw new Error('创建 VideoPolygon 失败：参数无效。');
    }

    this.viewer = viewer;
    this.options = {
      alpha: 1,
      loop: true,
      clampToGround: false,
      ...options
    };

    this.videoElement = null;
    this.polygonEntity = null;
    this.hls = null;

    // 构造函数立即返回，并启动异步的初始化流程。
    // 这不会阻塞主线程。

    this.destroy();

    this._initialize();
  }

  /**
   * 异步初始化方法：处理所有耗时的加载步骤。
   * @private
   */
  async _initialize() {
    try {
      this._createVideoElement();
      await this._loadAndBindHLSVideo();
      await this._waitForVideoReady();

      this._createPolygonEntity();
      console.log('[✅] 视频多边形初始化成功。');
    } catch (error) {
      console.error('初始化视频多边形失败:', error);
      // 如果任何步骤失败，调用 destroy 来清理已创建的资源。
      this.destroy();
    }
  }

  /**
   * 创建和配置 HTML video 元素。
   * @private
   */
  _createVideoElement() {
    this.videoElement = document.createElement('video');
    this.videoElement.id = 'monitorVideoElement'
    this.videoElement.autoplay = true;
    this.videoElement.muted = true;
    this.videoElement.loop = this.options.loop;
    this.videoElement.playsInline = true;
    this.videoElement.crossOrigin = 'anonymous';
    this.videoElement.style.display = 'none';
    document.body.appendChild(this.videoElement);
  }

  /**
   * 加载 HLS 视频流并将其绑定到 video 元素。
   * 这是一个异步方法，返回一个 Promise。
   * @private
   * @returns {Promise<void>}
   */
  _loadAndBindHLSVideo() {
    return new Promise((resolve, reject) => {
      const { m3u8Url } = this.options;

      if (Hls.isSupported()) {
        this.hls = new Hls({
          // HLS.js 配置
          enableWorker: true, // 启动工作线程
          lowLatencyMode: true // 低延迟模式
        });

        this.hls.loadSource(m3u8Url);
        this.hls.attachMedia(this.videoElement);

        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.hls.currentLevel = this.hls.levels.length - 1; // Default to highest quality
          // this.hls.autoLevelEnabled = false;
          this.videoElement.play().catch(e => console.warn('视频自动播放被浏览器阻止:', e));
          resolve(); // 当 manifest 解析成功时，Promise 完成。
        });

        this.hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('[HLS] 致命错误:', data);
            reject(data); // 当发生致命错误时，Promise 拒绝。
          }
        });
      } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        this.videoElement.src = m3u8Url;
        this.videoElement.addEventListener('loadedmetadata', () => {
          this.videoElement.play().catch(e => console.warn('Safari 视频自动播放被阻止:', e));
          resolve();
        });
        this.videoElement.addEventListener('error', () => reject(new Error('在 Safari 中播放 HLS 失败。')));
      } else {
        reject(new Error('当前浏览器不支持 HLS 视频流。'));
      }
    });
  }

  /**
   * 等待视频进入可播放状态。
   * @private
   * @returns {Promise<void>}
   */
  _waitForVideoReady() {
    return new Promise((resolve) => {
      const check = () => {
        if (this.videoElement && this.videoElement.readyState >= 2 && this.videoElement.videoWidth > 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * 创建 Cesium 实体并应用视频材质。
   * @private
   */
  _createPolygonEntity() {
    const { positions, clampToGround, alpha } = this.options;
    const cartesianPositions = this._convertToCartesianArray(positions);

    this.polygonEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: { positions: cartesianPositions },
        perPositionHeight: !clampToGround,
        material: new Cesium.ImageMaterialProperty({
          image: this.videoElement,
          transparent: true,
          color: Cesium.Color.WHITE.withAlpha(alpha)
        })
      }
    });
  }

  /**
   * 更新多边形的形状。
   * @param {Cesium.Cartesian3[] | number[]} newPositions 新的多边形点位。
   */
  updatePositions(newPositions) {
    if (!this.polygonEntity || !newPositions || newPositions.length < 3) {
      console.error('更新位置失败：无效的点位。');
      return;
    }
    const cartesianPositions = this._convertToCartesianArray(newPositions);
    this.polygonEntity.polygon.hierarchy = new Cesium.PolygonHierarchy(cartesianPositions);
    this.options.positions = newPositions;
  }

  /**
   * 销毁实例，清理所有资源。
   */
  destroy() {
    if (this.polygonEntity) {
      this.viewer.entities.remove(this.polygonEntity);
      this.polygonEntity = null;
    }
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src'); // 移除 src
      this.videoElement.load();
      document.body.removeChild(this.videoElement);
      this.videoElement = null;
    }
    console.log('[❌] 视频多边形已成功销毁。');
  }

  /**
   * 转换点位数组格式。
   * @private
   */
  _convertToCartesianArray(positions) {
    if (positions.length > 0 && typeof positions[0] === 'number') {
      return Cesium.Cartesian3.fromDegreesArray(positions);
    }
    return positions;
  }
}
