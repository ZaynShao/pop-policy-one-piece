import { Link } from 'react-router-dom';
import { Button, Result, Space } from 'antd';
import { palette } from '@/tokens';

/**
 * 移动端 — 录入成功页
 */
export function MobileDonePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: palette.bgBase,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Result
        status="success"
        title="拜访已录入"
        subTitle="桌面端可以查看 / 编辑这条记录"
        extra={
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Link to="/m/visit/new" style={{ width: '100%' }}>
              <Button type="primary" size="large" block style={{ height: 56, fontSize: 16 }}>
                再录一笔
              </Button>
            </Link>
            <Link to="/" style={{ width: '100%' }}>
              <Button size="large" block style={{ height: 48 }}>
                回桌面端
              </Button>
            </Link>
          </Space>
        }
      />
    </div>
  );
}
