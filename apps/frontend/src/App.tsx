import { FormEvent, useEffect, useRef, useState } from 'react';
import './App.css';

type RegulationSummary = {
  serialNumber: string;
  lawId: string;
  name: string;
  lawType: string;
  effectiveDate: string;
};
type RegulationArticle = { number: string; title: string; content: string; section: boolean };
type RegulationDetail = {
  lawId: string;
  name: string;
  lawType: string;
  competentAuthority: string;
  effectiveDate: string;
  articles: RegulationArticle[];
};
type SearchResponse = {
  totalCount: number;
  page: number;
  hasNext: boolean;
  items: RegulationSummary[];
};
type RelatedRegulation = { lawId: string; name: string; relationship: string };

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return value.length === 8 ? `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6)}` : value;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error('법령 정보를 불러오지 못했습니다.');
  return response.json() as Promise<T>;
}

function App() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [items, setItems] = useState<RegulationSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedSerialNumber, setSelectedSerialNumber] = useState('');
  const [detail, setDetail] = useState<RegulationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [relatedLaws, setRelatedLaws] = useState<RelatedRegulation[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const articleRefs = useRef<Record<number, HTMLElement | null>>({});

  async function loadRelatedLaws(lawId: string) {
    setRelatedLoading(true);
    try {
      setRelatedLaws(await request<RelatedRegulation[]>(`/api/regulations/${lawId}/related-laws`));
    } catch {
      setRelatedLaws([]);
    } finally {
      setRelatedLoading(false);
    }
  }

  async function selectDetail(path: string, serialNumber = '') {
    setDetailLoading(true);
    setDetailError('');
    setSelectedSerialNumber(serialNumber);
    try {
      const nextDetail = await request<RegulationDetail>(path);
      setDetail(nextDetail);
      void loadRelatedLaws(nextDetail.lawId);
    } catch (error) {
      setDetail(null);
      setRelatedLaws([]);
      setDetailError(error instanceof Error ? error.message : '법령 상세를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  }

  function selectLaw(serialNumber: string) {
    void selectDetail(`/api/regulations/${serialNumber}`, serialNumber);
  }
  function selectLawById(lawId: string) {
    void selectDetail(`/api/regulations/by-law-id/${lawId}`);
  }

  async function loadRegulations(nextPage: number, replace: boolean, searchQuery: string) {
    setListLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams({ page: String(nextPage), size: String(PAGE_SIZE) });
      if (searchQuery) params.set('query', searchQuery);
      const result = await request<SearchResponse>(`/api/regulations?${params}`);
      setItems((current) => (replace ? result.items : [...current, ...result.items]));
      setPage(result.page);
      setTotalCount(result.totalCount);
      setHasNext(result.hasNext);
      if (replace && result.items[0]) selectLaw(result.items[0].serialNumber);
    } catch (error) {
      setListError(error instanceof Error ? error.message : '법령 목록을 불러오지 못했습니다.');
      if (replace) {
        setItems([]);
        setDetail(null);
      }
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    void loadRegulations(1, true, '');
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    setActiveQuery(nextQuery);
    void loadRegulations(1, true, nextQuery);
  }

  function handleResultScroll(event: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40 && hasNext && !listLoading)
      void loadRegulations(page + 1, false, activeQuery);
  }

  const normalArticles = detail?.articles.filter((article) => !article.section) ?? [];
  const featuredArticle =
    normalArticles.find((article) => article.number === '1') ?? normalArticles[0];
  const keyArticles = normalArticles
    .filter((article) => article !== featuredArticle)
    .slice(0, 3)
    .map((article) => ({
      article,
      index: detail?.articles.findIndex((item) => item === article) ?? -1,
    }));

  // P2: 위험 항목과 법령 조문을 연결하는 '활로 업무 연결' 영역은 후속 작업에서 구현한다.
  return (
    <main className="law-page">
      <header className="page-heading">
        <p className="eyebrow">안전 운영</p>
        <h1>안전 법령</h1>
        <p>대피와 공간 안전 검토에 필요한 법령을 검색합니다.</p>
      </header>
      <form className="search-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="law-search">
          법령 검색어
        </label>
        <input
          id="law-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: 피난, 소방, 다중이용업소"
        />
        <button type="submit">검색</button>
      </form>
      <section className="law-workspace" aria-label="법령 조회">
        <aside className="search-results">
          <div className="panel-heading">
            <h2>검색 결과</h2>
            <span>{totalCount}건</span>
          </div>
          <div className="result-list" onScroll={handleResultScroll}>
            {listError && <p className="status-message error">{listError}</p>}
            {!listLoading && !listError && items.length === 0 && (
              <p className="status-message">검색 결과가 없습니다.</p>
            )}
            {items.map((item) => (
              <button
                className={`result-item ${selectedSerialNumber === item.serialNumber ? 'selected' : ''}`}
                key={item.serialNumber}
                onClick={() => selectLaw(item.serialNumber)}
                type="button"
              >
                <strong>{item.name}</strong>
                <span>
                  {item.lawType} · 시행 {formatDate(item.effectiveDate)}
                </span>
              </button>
            ))}
            {listLoading && <p className="status-message">법령 목록을 불러오는 중입니다.</p>}
          </div>
        </aside>
        <section className="law-detail" aria-live="polite">
          {detailLoading && <p className="status-message">법령 상세를 불러오는 중입니다.</p>}
          {detailError && <p className="status-message error">{detailError}</p>}
          {!detailLoading && !detailError && !detail && (
            <p className="status-message">좌측 목록에서 법령을 선택하세요.</p>
          )}
          {detail && !detailLoading && (
            <div className="detail-scroll">
              <div className="detail-intro">
                <p className="eyebrow">법령 상세</p>
                <h2>{detail.name}</h2>
                <p>
                  {detail.lawType} · {detail.competentAuthority} · 시행{' '}
                  {formatDate(detail.effectiveDate)}
                </p>
              </div>
              {featuredArticle && (
                <article className="featured-article">
                  <p className="section-label">대표 조문</p>
                  <h3>
                    제{featuredArticle.number}조{' '}
                    {featuredArticle.title && `(${featuredArticle.title})`}
                  </h3>
                  <p>{featuredArticle.content}</p>
                </article>
              )}
              <section className="related-section">
                <div className="section-heading">
                  <h3>관련 법령</h3>
                  {relatedLoading && <span>불러오는 중</span>}
                </div>
                {relatedLaws.length > 0 ? (
                  <div className="related-law-list">
                    {relatedLaws.map((law) => (
                      <button
                        key={law.lawId}
                        onClick={() => selectLawById(law.lawId)}
                        type="button"
                      >
                        <strong>{law.name}</strong>
                        <span>{law.relationship}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  !relatedLoading && <p className="subtle-message">연결된 관련 법령이 없습니다.</p>
                )}
              </section>
              {keyArticles.length > 0 && (
                <section className="key-articles">
                  <h3>주요 조문</h3>
                  <div>
                    {keyArticles.map(({ article, index }) => (
                      <button
                        key={`${article.number}-${article.title}`}
                        onClick={() =>
                          articleRefs.current[index]?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }
                        type="button"
                      >
                        제{article.number}조 {article.title}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="all-articles">
                <h3>전체 조문</h3>
                {detail.articles.map((article, index) => (
                  <article
                    className={article.section ? 'article-section' : 'article-content'}
                    key={`${article.number}-${article.title}-${index}`}
                    ref={(element) => {
                      articleRefs.current[index] = element;
                    }}
                  >
                    {article.section ? (
                      <h4>{article.content}</h4>
                    ) : (
                      <>
                        <h4>
                          제{article.number}조 {article.title && `(${article.title})`}
                        </h4>
                        <p>{article.content}</p>
                      </>
                    )}
                  </article>
                ))}
              </section>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
