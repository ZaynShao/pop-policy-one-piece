import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import App from './App';
import './styles/global.css';
import { useMapStore } from './stores/mapStore';
import { useVisitStore } from './stores/visitStore';
import { usePinStore } from './stores/pinStore';

if (import.meta.env.DEV) {
  (window as any).__zop = {
    map: useMapStore,
    visits: useVisitStore,
    pins: usePinStore,
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00d4ff',
          colorInfo: '#00d4ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          colorBgBase: '#0a1628',
          colorBgLayout: '#0a1628',
          colorBgContainer: 'rgba(15, 29, 53, 0.7)',
          colorBgElevated: '#0f1d35',
          colorBorder: 'rgba(0, 212, 255, 0.2)',
          colorBorderSecondary: 'rgba(0, 212, 255, 0.12)',
          colorTextBase: '#e6f4ff',
          borderRadius: 8,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
        components: {
          Layout: {
            headerBg: 'rgba(10, 22, 40, 0.95)',
            bodyBg: '#0a1628',
            siderBg: 'rgba(15, 29, 53, 0.7)',
          },
          Menu: {
            darkItemBg: 'transparent',
            itemSelectedBg: 'rgba(0, 212, 255, 0.15)',
          },
          Card: {
            colorBgContainer: 'rgba(15, 29, 53, 0.8)',
          },
          Table: {
            headerBg: 'rgba(0, 212, 255, 0.08)',
            rowHoverBg: 'rgba(0, 212, 255, 0.06)',
          },
          Segmented: {
            itemSelectedBg: '#00d4ff',
            itemSelectedColor: '#06111f',
          },
          FloatButton: {
            colorBgElevated: 'rgba(15, 29, 53, 0.95)',
          },
        },
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
