import './SystemManagementPage.css';

type UserStatus = '활성' | '중지';

interface User {
  name: string;
  role: string;
  branch: string;
  lastLogin: string;
  status: UserStatus;
}

const users: User[] = [
  { name: '김안전', role: '안전 검토자', branch: '전체 지점', lastLogin: '오늘 14:28', status: '활성' },
  { name: '박운영', role: '운영 담당자', branch: '서울·판교', lastLogin: '오늘 13:02', status: '활성' },
  { name: '이검토', role: '안전 검토자', branch: '서울', lastLogin: '어제 17:44', status: '활성' },
  { name: '최담당', role: '운영 담당자', branch: '대구·울산', lastLogin: '07.28', status: '활성' },
  { name: '시스템 관리자', role: '관리자', branch: '전체 지점', lastLogin: '07.27', status: '활성' },
  { name: '테스트 계정', role: '운영 담당자', branch: '테스트', lastLogin: '07.20', status: '중지' },
];

const roles = [
  { name: '운영 담당자', permissions: '도면·조건·실행', tone: 'operator' },
  { name: '안전 검토자', permissions: '결과·위험·보고서', tone: 'reviewer' },
  { name: '관리자', permissions: '계정·기준·실행 이력', tone: 'admin' },
];

function SystemManagementPage() {
  return (
    <main className="system-management-page">
      <div className="system-management-content">
        <header className="page-header">
          <div>
            <h1>시스템 관리</h1>
            <p>사용자 권한, 공통 기준과 백그라운드 작업 상태를 관리합니다.</p>
          </div>
          <div className="account-control">
            <button type="button">사용자 초대</button>
          </div>
        </header>

        <section className="management-card" aria-labelledby="users-heading">
          <div className="card-heading">
            <h2 id="users-heading">사용자·권한</h2>
            <button type="button">전체 역할</button>
          </div>

          <div className="table-wrap">
            <table>
              <caption className="sr-only">사용자별 역할과 상태</caption>
              <thead>
                <tr>
                  <th scope="col">사용자</th>
                  <th scope="col">역할</th>
                  <th scope="col">점포 지점</th>
                  <th scope="col">최근 로그인</th>
                  <th scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr className={index === 0 ? 'selected' : ''} key={user.name}>
                    <th scope="row">{user.name}</th>
                    <td>{user.role}</td>
                    <td>{user.branch}</td>
                    <td>{user.lastLogin}</td>
                    <td>
                      <span className={`status ${user.status === '중지' ? 'stopped' : ''}`}>{user.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="role-section">
            <h3>역할별 주요 권한</h3>
            <div className="role-list">
              {roles.map((role) => (
                <article className={`role-card ${role.tone}`} key={role.name}>
                  <h4>{role.name}</h4>
                  <p>{role.permissions}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default SystemManagementPage;
