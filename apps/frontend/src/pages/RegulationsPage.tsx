import { FormEvent, useEffect, useRef, useState } from 'react';
import './RegulationsPage.css';

type RegulationSummary = {
  serialNumber: string;
  lawId: string;
  name: string;
  lawType: string;
  effectiveDate: string;
};

type RegulationArticle = {
  number: string;
  title: string;
  content: string;
  section: boolean;
};

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

/** 모든 법령 API 호출의 HTTP 오류를 하나의 화면 오류 상태로 변환한다. */
async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error('법령 정보를 불러오지 못했습니다.');
  }
  return response.json() as Promise<T>;
}

function RegulationsPage() {
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
  const hasLoadedInitialList = useRef(false);
  const latestListRequestId = useRef(0);

  async function loadRelatedLaws(lawId: string) {
    setRelatedLoading(true);
    try {
      setRelatedLaws(await request<RelatedRegulation[]>(`/api/regulations/${lawId}/related-laws`));
    } catch {
      // 관련 법령 API 권한이 아직 승인되지 않아도 선택한 법령 상세는 유지한다.
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
      // 관련 법령 API는 목록의 MST가 아닌 상세 응답의 법령 ID를 사용한다.
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
    const requestId = ++latestListRequestId.current;
    setListLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams({ page: String(nextPage), size: String(PAGE_SIZE) });
      if (searchQuery) {
        params.set('query', searchQuery);
      }

      const result = await request<SearchResponse>(`/api/regulations?${params}`);
      if (requestId !== latestListRequestId.current) {
        return;
      }

      setItems((current) => (replace ? result.items : [...current, ...result.items]));
      setPage(result.page);
      setTotalCount(result.totalCount);
      setHasNext(result.hasNext);

      if (replace && result.items[0]) {
        selectLaw(result.items[0].serialNumber);
      }
    } catch (error) {
      if (requestId !== latestListRequestId.current) {
        return;
      }

      setListError(error instanceof Error ? error.message : '법령 목록을 불러오지 못했습니다.');
      if (replace) {
        setItems([]);
        setDetail(null);
      }
    } finally {
      if (requestId === latestListRequestId.current) {
        setListLoading(false);
      }
    }
  }

  useEffect(() => {
    // StrictMode 개발 환경에서는 Effect를 두 번 실행하므로 초기 외부 API 요청을 한 번만 보낸다.
    if (hasLoadedInitialList.current) {
      return;
    }

    hasLoadedInitialList.current = true;
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
    // 목록 하단 40px 전부터 다음 페이지를 요청해 스크롤 흐름을 끊지 않는다.
    if (scrollTop + clientHeight >= scrollHeight - 40 && hasNext && !listLoading) {
      void loadRegulations(page + 1, false, activeQuery);
    }
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
    <main className="regulations-page">
      <div className="regulations-page__content">
        <header className="regulations-page__heading">
          <p className="regulations-page__eyebrow">안전 운영</p>
          <h1>안전 법령</h1>
          <p>활로 공간 안전 검토에 필요한 법령을 검색합니다.</p>
        </header>
        <form className="regulations-search" onSubmit={handleSubmit}>
          <label className="regulations-page__sr-only" htmlFor="law-search">
            법령 검색어
          </label>
          <input
            id="law-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예: 피난, 통로, 다중이용업소"
          />
          <button type="submit">검색</button>
        </form>
        <section className="regulations-workspace" aria-label="법령 조회">
          <aside className="regulations-panel">
            <div className="regulations-panel__heading">
              <h2>검색 결과</h2>
              <span>{totalCount}건</span>
            </div>
            <div className="regulations-result-list" onScroll={handleResultScroll}>
              {listError && (
                <p className="regulations-status regulations-status--error">{listError}</p>
              )}
              {!listLoading && !listError && items.length === 0 && (
                <p className="regulations-status">검색 결과가 없습니다.</p>
              )}
              {items.map((item) => (
                <button
                  className={`regulations-result-item ${selectedSerialNumber === item.serialNumber ? 'is-selected' : ''}`}
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
              {listLoading && <p className="regulations-status">법령 목록을 불러오는 중입니다.</p>}
            </div>
          </aside>
          <section className="regulations-panel regulations-detail" aria-live="polite">
            {detailLoading && <p className="regulations-status">법령 상세를 불러오는 중입니다.</p>}
            {detailError && (
              <p className="regulations-status regulations-status--error">{detailError}</p>
            )}
            {!detailLoading && !detailError && !detail && (
              <p className="regulations-status">좌측 목록에서 법령을 선택하세요.</p>
            )}
            {detail && !detailLoading && (
              <div className="regulations-detail__scroll">
                <div className="regulations-detail__intro">
                  <p className="regulations-page__eyebrow">법령 상세</p>
                  <h2>{detail.name}</h2>
                  <p>
                    {detail.lawType} · {detail.competentAuthority} · 시행{' '}
                    {formatDate(detail.effectiveDate)}
                  </p>
                </div>
                {featuredArticle && (
                  <article className="regulations-featured-article">
                    <p className="regulations-page__eyebrow">대표 조문</p>
                    <h3>
                      제{featuredArticle.number}조{' '}
                      {featuredArticle.title && `(${featuredArticle.title})`}
                    </h3>
                    <p>{featuredArticle.content}</p>
                  </article>
                )}
                <section className="regulations-related-section">
                  <div className="regulations-section-heading">
                    <h3>관련 법령</h3>
                    {relatedLoading && <span>불러오는 중</span>}
                  </div>
                  {relatedLaws.length > 0 ? (
                    <div className="regulations-related-list">
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
                    !relatedLoading && (
                      <p className="regulations-subtle-message">연결된 관련 법령이 없습니다.</p>
                    )
                  )}
                </section>
                {keyArticles.length > 0 && (
                  <section className="regulations-key-articles">
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
                <section className="regulations-all-articles">
                  <h3>전체 조문</h3>
                  {detail.articles.map((article, index) => (
                    <article
                      className={
                        article.section
                          ? 'regulations-article-section'
                          : 'regulations-article-content'
                      }
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
      </div>
    </main>
  );
}

export default RegulationsPage;
