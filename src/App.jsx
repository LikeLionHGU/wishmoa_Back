import React, { useState } from 'react';
import { 
  Upload, Search, Image as ImageIcon, Loader2, Sparkles, 
  ShoppingBag, Heart, Home, ArrowLeft, Plus, ChevronDown, Edit2, User 
} from 'lucide-react';
import wishmoaLogo from '../위시모아.svg';

// === Mock Data Section (원본 그대로 유지) ===
const MOCK_PRODUCTS = [
  { id: 1, name: '오버사이즈 라벤더 후드', price: '45,000원', brand: 'Trend Studio', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=300&h=400&auto=format&fit=crop' },
  { id: 2, name: '슬림핏 코튼 팬츠', price: '38,000원', brand: 'Urban Basic', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=300&h=400&auto=format&fit=crop' },
];

function App() {
  // 1번 원본 코드의 State 상태 및 기능 로직 100% 동일 보존
  const [image, setImage] = useState(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
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

  // === Gemini API 이미지 분석 로직 (원본 기능 일절 수정 없음) ===
  const handleAnalyze = async () => {
    if (!image) return;

    setLoading(true);
    setAnalysisResult(null);

    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const G_url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
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

       {/*이 부분 코드 수정-> 상대 경로라 오류 */}
      const response = await fetch(
        G_url,
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

  // === 위시리스트 저장 핸들러 ===
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
    setCurrentTab('wish'); 
    setAnalysisResult(null); 
    setImage(null);
  };

  const categories = ['전체', ...new Set(wishlist.map(item => item.category))];
  const filteredWishlist = wishCategory === '전체' ? wishlist : wishlist.filter(item => item.category === wishCategory);

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 shadow-2xl flex flex-col font-sans relative overflow-hidden select-none text-gray-900">
      
      {/* 1. 상단 타이틀 헤더 영역 (결과창 여부에 따라 유동적 분기) */}
      {!analysisResult ? (
        <header className="px-5 py-4 flex items-center justify-between bg-white border-b border-gray-100 flex-shrink-0 z-50">
          <img src={wishmoaLogo} alt="위시모아" className="h-6 w-auto object-contain" />
          <div className="flex items-center gap-4 text-gray-800">
            <Search size={22} className="text-gray-700" />
            <ShoppingBag size={22} className="text-gray-700" />
          </div>
        </header>
      ) : (
        <header className="px-4 py-4 flex items-center bg-white border-b border-gray-50 flex-shrink-0 z-50">
          <button onClick={() => { setAnalysisResult(null); setImage(null); }} className="text-gray-800 p-1 flex items-center gap-1 text-xs font-bold">
            <ArrowLeft size={18} /> 다시 업로드하기
          </button>
        </header>
      )}

      {/* 2. 중앙 컨텐츠 메인 스크롤 바디 영역 */}
      <div className="flex-1 overflow-y-auto bg-white">
        
        {/* ─── [A 세션] HOME 탭 메인: 이미지 업로드 대기 상태 ─── */}
        {currentTab === 'home' && !analysisResult && (
          <div className="p-5 space-y-6 min-h-full flex flex-col justify-center">
            <label className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50/60 transition-colors h-80 relative overflow-hidden flex-shrink-0">
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {image ? (
                <img src={image} alt="Preview" className="absolute w-full h-full object-cover" />
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
                    <Plus size={28} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">사진을 추가해 주세요</h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">의류, 신발, 가방, 잡화 등<br />원하는 아이템 사진을 등록해 주세요</p>
                  </div>
                </div>
              )}
            </label>

           

            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-indigo-600">
                <Sparkles size={12} className="fill-indigo-100" /> AI가 상품 정보를 분석하고 최저가 구매 링크를 찾아드려요
              </div>
              <button 
                onClick={handleAnalyze}
                disabled={!image || loading}
                className={`w-full py-4 text-white text-center rounded-2xl font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all duration-200
                  ${!image || loading 
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 active:scale-[0.99]'}`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    구글 AI가 패션 분석 중...
                  </>
                ) : (
                  'AI로 상품 분석 시작하기'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── [B 세션] 📌 [기능 통합] AI 분석 결과창 (푸터 위에 고정되어 표출) ─── */}
        {analysisResult && (
          <div className="pb-6 animate-in slide-in-from-bottom-4 duration-300">
            {/* 요청 사항: 업로드 사진 비율 축소 스퀘어 스킨 */}
            <div className="w-1/2 mx-auto mt-6 p-4 aspect-square rounded-xl overflow-hidden shadow-sm border border-gray-100 bg-gray-50 flex items-center justify-center">
              <img src={image} alt="분석이미지" className="max-w-full max-h-full object-contain" />
            </div>

            <div className="p-5 space-y-4 border-b border-gray-100 mt-4">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1 text-indigo-600 font-bold">
                  <Sparkles size={14} className="fill-indigo-100" /> AI가 정보를 추출했어요
                </div>
                <button className="flex items-center gap-0.5 text-gray-400 font-medium">정보 수정하기 <Edit2 size={12} /></button>
              </div>

              <h2 className="text-xl font-bold text-gray-900">{analysisResult.category} 스타일 추천</h2>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold">#{analysisResult.category}</span>
                <span className="px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">#{analysisResult.color}</span>
              </div>

              <div className="space-y-3 pt-4 text-sm border-t border-gray-50 mt-4">
                <div className="flex"><span className="w-20 text-gray-400 font-medium">분류</span><span className="text-gray-800 font-bold">{analysisResult.category}</span></div>
                <div className="flex"><span className="w-20 text-gray-400 font-medium">색상</span><span className="text-gray-800 font-bold">{analysisResult.color}</span></div>
                <div className="flex"><span className="w-20 text-gray-400 font-medium">스타일</span><span className="text-gray-800 font-bold">{analysisResult.style}</span></div>
                <div className="flex"><span className="w-20 text-gray-400 font-medium">분위기</span><span className="text-gray-800 font-bold">{analysisResult.vibe}</span></div>
              </div>
            </div>

            {analysisResult.link && (
              <div className="p-5 space-y-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-sm">최저가 구매 링크</h3>
                <div className="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center font-black text-xs text-indigo-600">LINK</div>
                    <div>
                      <span className="text-sm font-bold text-gray-800">구글 Shopping 결과</span>
                      <p className="text-[10px] text-gray-400 mt-0.5">유사 상품 최저가 보기</p>
                    </div>
                  </div>
                  <a href={analysisResult.link} target="_blank" rel="noopener noreferrer" className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-indigo-700">이동하기</a>
                </div>
              </div>
            )}

            <div className="p-5">
              <button 
                onClick={handleSaveToWishlist}
                className="w-full flex items-center justify-center gap-1.5 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-indigo-100 active:scale-[0.99] transition-transform"
              >
                <Heart size={18} className="fill-white" /> 위시리스트에 저장
              </button>
            </div>
          </div>
        )}

        {/* ─── [C 세션] WISHLIST 탭: 3열 격자 적재 보관함 ─── */}
        {currentTab === 'wish' && (
          <div className="flex flex-col h-full bg-white">
            <div className="bg-white px-4 border-b border-gray-100 flex gap-6 overflow-x-auto scrollbar-hide flex-shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setWishCategory(cat)}
                  className={`py-3 text-sm font-bold relative whitespace-nowrap transition-colors
                    ${wishCategory === cat ? 'text-indigo-600' : 'text-gray-400'}`}
                >
                  {cat}
                  {cat === '전체' && <span className="text-[10px] ml-1 text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">{wishlist.length}</span>}
                  {wishCategory === cat && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide bg-white border-b border-gray-50 flex-shrink-0">
              {['색상', '가격대', '스타일', '상세옵션'].map((filter) => (
                <button key={filter} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 bg-white">
                  {filter} <ChevronDown size={12} className="text-gray-400" />
                </button>
              ))}
            </div>

            <main className="p-3 bg-white">
              {filteredWishlist.length === 0 ? (
                <div className="text-center text-gray-300 py-24 flex flex-col items-center justify-center gap-3">
                  <Heart size={48} className="text-gray-200" />
                  <p className="text-sm font-medium text-gray-400">저장된 {wishCategory !== '전체' ? wishCategory : '아이템'}이 없습니다.</p>
                  <p className="text-xs text-gray-400">가운데 [+] 버튼을 눌러 사진 분석을 진행해 보세요!</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filteredWishlist.map((item) => (
                    <div key={item.id} className="flex flex-col animate-in fade-in zoom-in-95 duration-200">
                      <div className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden mb-1.5">
                        <img src={item.image} alt="저장본" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/20 backdrop-blur-sm">
                          <Heart size={14} className="fill-indigo-500 text-indigo-500" />
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-gray-800 line-clamp-1 px-0.5">{item.category} / {item.color}</h4>
                      <p className="text-[10px] text-indigo-500 font-semibold mt-0.5 px-0.5 truncate">{item.style}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5 px-0.5">{item.date}</p>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {/* 3. 🌟 [요청 집중 반영] 전역 글로벌 하단 푸터 (시안 4버튼 스펙 구현 + 결과창에서도 상시 노출 고정) */}
      <footer className="bg-white border-t border-gray-100 p-2 flex justify-around items-center sticky bottom-0 max-w-md w-full left-0 z-50 shadow-[0_-2px_12px_rgba(0,0,0,0.02)] flex-shrink-0">
        {/* 홈 버튼 */}
        <button 
          onClick={() => { setCurrentTab('home'); setAnalysisResult(null); }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${currentTab === 'home' && !analysisResult ? 'text-indigo-600 font-bold scale-105' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Home size={20} className={currentTab === 'home' && !analysisResult ? 'fill-indigo-50' : ''} />
          <span className="text-[10px]">홈</span>
        </button>

        {/* AI코디 버튼 (결과창 활성화 스냅샷 시 점등) */}
        <button 
          onClick={() => { if(!image) { setCurrentTab('home'); setAnalysisResult(null); } }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${analysisResult ? 'text-indigo-600 font-bold scale-105' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Sparkles size={20} className={analysisResult ? 'fill-indigo-50' : ''} />
          <span className="text-[10px]">AI코디</span>
        </button>

        {/* 중앙 대형 플러스 업로드 트리거 액션바 */}
        <div className="relative -top-4">
          <button 
            onClick={() => { setCurrentTab('home'); setAnalysisResult(null); setImage(null); }}
            className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-200 border-4 border-white active:scale-95 transition-transform"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>

        {/* 위시 버튼 */}
        <button 
          onClick={() => setCurrentTab('wish')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${currentTab === 'wish' ? 'text-indigo-600 font-bold scale-105' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Heart size={20} className={currentTab === 'wish' ? 'fill-indigo-50' : ''} />
          <span className="text-[10px]">위시</span>
        </button>

        {/* 프로필 버튼 */}
        <button 
          className="flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-gray-400 hover:text-gray-600"
        >
          <User size={20} />
          <span className="text-[10px]">프로필</span>
        </button>
      </footer>

    </div>
  );
}

export default App;