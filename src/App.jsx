import React, { useState } from 'react';
import { Upload, Search, Image as ImageIcon, Loader2, Sparkles, ShoppingBag, Heart, Home } from 'lucide-react';

// === Mock Data Section ===
const MOCK_PRODUCTS = [
  { id: 1, name: '오버사이즈 라벤더 후드', price: '45,000원', brand: 'Trend Studio', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=300&h=400&auto=format&fit=crop' },
  { id: 2, name: '슬림핏 코튼 팬츠', price: '38,000원', brand: 'Urban Basic', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=300&h=400&auto=format&fit=crop' },
];

function App() {
  const [image, setImage] = useState(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // 🌟 새로 추가된 위시리스트 및 탭 상태
  const [wishlist, setWishlist] = useState([]);
  const [currentTab, setCurrentTab] = useState('home'); // 'home' | 'wish'
  const [wishCategory, setWishCategory] = useState('전체');

  // === 이미지 파일 선택 핸들러 ===
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setUrl('');
      };
      reader.readAsDataURL(file);
    }
  };

  // === 이미지 URL 입력 핸들러 ===
  const handleUrlSubmit = () => {
    if (url) {
      setImage(url);
    }
  };

  // === Gemini API 이미지 분석 로직 ===
  const handleAnalyze = async () => {
    if (!image) return;

    setLoading(true);
    setAnalysisResult(null);

    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

    try {
      let base64Data;
      let mimeType = 'image/jpeg';

      if (image.startsWith('data:image')) {
        base64Data = image.split(',')[1];
        mimeType = image.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      } else {
        const imgRes = await fetch(image);
        const blob = await imgRes.blob();
        mimeType = blob.type || 'image/jpeg';
        const buffer = await blob.arrayBuffer();
        base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }

      const response = await fetch(
        `/api-gemini/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `이 이미지 속 주요 패션 아이템을 1개 선정해서 분석해줘. 정보를 찾을 수 없는 경우 최대한 추론해서 채워줘.
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마:
{
  "category": "상품 종류 (반드시 '상의', '하의', '아우터', '신발', '액세서리' 중 하나로만 대분류를 작성해)",
  "color": "주요 색상 (예: 블랙)",
  "style": "스타일이나 특징 (예: 와이드핏)",
  "vibe": "전반적인 분위기나 느낌 (예: 캐주얼)",
  "purchase_link": "해당 상품을 구매하거나 유사한 상품을 검색할 수 있는 구글 쇼핑 검색 링크"
}`
                },
                {
                  inline_data: { mime_type: mimeType, data: base64Data }
                }
              ]
            }],
            generationConfig: {
              response_mime_type: 'application/json'
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'API 호출 실패');
      }

      let resultText = data.candidates[0].content.parts[0].text;
      resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();

      let result = {};
      try {
        result = JSON.parse(resultText);
      } catch (e) {
        console.error('JSON 파싱 실패:', e);
        throw new Error('응답 데이터를 분석할 수 없습니다.');
      }

      // 분류 키워드를 정제하여 저장 시 깔끔하게 그룹핑되도록 처리
      let parsedCategory = result.category || '기타';
      if (parsedCategory.includes('상의') || parsedCategory.includes('티셔츠') || parsedCategory.includes('니트')) parsedCategory = '상의';
      else if (parsedCategory.includes('하의') || parsedCategory.includes('바지') || parsedCategory.includes('팬츠')) parsedCategory = '하의';
      else if (parsedCategory.includes('아우터') || parsedCategory.includes('자켓') || parsedCategory.includes('코트')) parsedCategory = '아우터';
      else if (parsedCategory.includes('신발') || parsedCategory.includes('스니커즈')) parsedCategory = '신발';
      else if (parsedCategory.includes('액세서리') || parsedCategory.includes('가방') || parsedCategory.includes('모자')) parsedCategory = '액세서리';

      setAnalysisResult({
        category: parsedCategory,
        color: result.color || '알 수 없음',
        style: result.style || '알 수 없음',
        vibe: result.vibe || '알 수 없음',
        link: result.purchase_link || ''
      });

    } catch (error) {
      console.error('Gemini API 오류:', error);
      alert('분석에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // === 🌟 위시리스트 저장 핸들러 ===
  const handleSaveToWishlist = () => {
    if (!analysisResult || !image) return;

    const newItem = {
      id: Date.now(),
      image: image,
      ...analysisResult,
      date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    };

    setWishlist([newItem, ...wishlist]);
    alert(`[${analysisResult.category}] 분류로 위시리스트에 저장되었습니다!`);
    setCurrentTab('wish'); // 저장 후 위시리스트 탭으로 이동
  };

  // 추출된 카테고리 목록 계산
  const categories = ['전체', ...new Set(wishlist.map(item => item.category))];
  const filteredWishlist = wishCategory === '전체' ? wishlist : wishlist.filter(item => item.category === wishCategory);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl flex flex-col font-sans">
      {/* Header */}
      <header className="p-6 border-b border-lavender-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-lavender-500 p-2 rounded-xl">
            <ShoppingBag className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Fashion Finder</h1>
        </div>
        <Sparkles className="text-lavender-400 w-6 h-6" />
      </header>

      <main className="flex-1 overflow-y-auto p-5 space-y-6 bg-lavender-50/30">

        {/* 탭 내용 분기 */}
        {currentTab === 'home' && (
          <>
            {/* Upload Section */}
            <section className="bg-white p-5 rounded-3xl shadow-sm border border-lavender-100">
              <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">이미지 업로드</h2>

              <div className="space-y-4">
                <div
                  className={`relative h-64 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all duration-300
                    ${image ? 'border-lavender-400 bg-white' : 'border-lavender-200 bg-lavender-50/50'}`}
                >
                  {image ? (
                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center space-y-2">
                      <ImageIcon className="w-12 h-12 text-lavender-300 mx-auto" />
                      <p className="text-sm text-gray-500">사진을 업로드하거나 URL을 넣어주세요</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-center gap-2 bg-lavender-100 text-lavender-700 py-3 rounded-xl font-medium cursor-pointer hover:bg-lavender-200 active:scale-95 transition-all">
                    <Upload size={18} />
                    파일 찾기
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                  <div className="flex bg-gray-100 rounded-xl overflow-hidden focus-within:ring-2 ring-lavender-400 transition-all">
                    <input
                      type="text"
                      placeholder="URL 입력..."
                      className="bg-transparent px-3 py-2 text-sm w-full outline-none"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <button
                      onClick={handleUrlSubmit}
                      className="bg-lavender-400 text-white p-2 hover:bg-lavender-500 transition-colors"
                    >
                      <Search size={18} />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!image || loading}
                  className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg
                    ${!image || loading
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-lavender-600 text-white hover:bg-lavender-700 active:scale-[0.98]'}`}
                >
                  {loading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <Search size={20} />
                      상품 분석하기
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Results Section */}
            {analysisResult && (
              <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* 🌟 명시적 분류 및 저장 버튼 UI */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-lavender-100">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-lavender-50">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold">
                        분류: {analysisResult.category}
                      </span>
                    </div>
                    <button
                      onClick={handleSaveToWishlist}
                      className="text-sm font-bold text-white bg-lavender-500 hover:bg-lavender-600 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
                    >
                      <Heart size={16} className="fill-white/20" /> 저장하기
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* 카테고리와 링크를 제외한 나머지 정보만 태그 형태로 출력 */}
                    {Object.entries(analysisResult).filter(([key]) => key !== 'link' && key !== 'category').map(([key, value]) => (
                      <span key={key} className="bg-lavender-50 border border-lavender-100 text-lavender-700 px-3 py-1 rounded-full text-xs font-medium">
                        #{value}
                      </span>
                    ))}
                  </div>
                </div>

                {analysisResult.link && (
                  <a
                    href={analysisResult.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-4 bg-gradient-to-r from-lavender-600 to-indigo-600 text-white text-center rounded-2xl font-bold hover:from-lavender-700 hover:to-indigo-700 transition-all shadow-lg active:scale-[0.98]"
                  >
                    상품 쇼핑 검색 결과 보기
                  </a>
                )}
              </section>
            )}
          </>
        )}

        {/* 🌟 위시리스트 탭 */}
        {currentTab === 'wish' && (
          <section className="animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 카테고리 탭 (상단) */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide border-b border-lavender-100 mb-6">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setWishCategory(cat)}
                  className={`whitespace-nowrap pb-2 px-1 font-bold transition-colors relative ${wishCategory === cat
                    ? 'text-indigo-600'
                    : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  {cat} {cat === '전체' && <span className="text-[10px] ml-1 text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">{wishlist.length}</span>}
                  {wishCategory === cat && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            {/* 위시리스트 아이템 그리드 */}
            {filteredWishlist.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <Heart size={48} className="mx-auto text-gray-200 mb-4" />
                <p>저장된 {wishCategory !== '전체' ? wishCategory : '아이템'}이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredWishlist.map(item => (
                  <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-lavender-50 hover:shadow-md transition-shadow group">
                    <div className="h-48 overflow-hidden relative">
                      <img src={item.image} alt={item.category} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
                        <Heart size={14} className="text-indigo-500 fill-indigo-500" />
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-[10px] text-gray-400">{item.date}</p>
                      <h4 className="text-sm font-semibold text-gray-800 truncate">{item.category} / {item.color}</h4>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-lavender-500 truncate max-w-[70%]">{item.style}</p>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noreferrer" className="bg-lavender-100 text-lavender-700 p-1.5 rounded-full hover:bg-lavender-200">
                            <ShoppingBag size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* 🌟 하단 네비게이션 바 */}
      <footer className="bg-white p-2 border-t border-lavender-100 flex justify-around items-center sticky bottom-0 pb-safe">
        <button
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${currentTab === 'home' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Home size={22} className={currentTab === 'home' ? 'fill-indigo-50' : ''} />
          <span className="text-[10px] font-bold">홈</span>
        </button>
        <button
          onClick={() => setCurrentTab('wish')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${currentTab === 'wish' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Heart size={22} className={currentTab === 'wish' ? 'fill-indigo-50' : ''} />
          <span className="text-[10px] font-bold">위시리스트</span>
        </button>
      </footer>
    </div>
  );
}

export default App;
