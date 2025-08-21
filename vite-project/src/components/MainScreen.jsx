import { useState } from 'react';

function MainScreen() {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' 또는 'leaderboard'
  const [activeNav, setActiveNav] = useState('home');

  // 더미 데이터
  const userProfile = {
    name: '엄마',
    profileImage: '👩‍💼',
    tokens: 15,
    completedActivities: 3,
    myRewards: ['영화 보기', '맛집 가기', '산책하기']
  };

  const liveFeed = [
    { from: '아빠', to: '엄마', message: '설거지 도와줘서 고마워', status: 'approved', time: '5분 전' },
    { from: '딸', to: '아빠', message: '숙제 봐줘서 감사해요', status: 'pending', time: '10분 전' },
    { from: '엄마', to: '딸', message: '방 정리를 깔끔하게 했네', status: 'approved', time: '15분 전' }
  ];

  const leaderboard = [
    { name: '엄마', tokens: 15, activities: 3, rank: 1 },
    { name: '아빠', tokens: 12, activities: 2, rank: 2 },
    { name: '딸', tokens: 8, activities: 1, rank: 3 },
    { name: '아들', tokens: 5, activities: 0, rank: 4 }
  ];

  const getRankColor = (rank) => {
    if (rank === 1) return 'text-yellow-600';
    if (rank === 2) return 'text-gray-600';  
    if (rank === 3) return 'text-orange-600';
    return 'text-gray-400';
  };

  const getStatusColor = (status) => {
    return status === 'approved' ? 'text-green-600' : 'text-yellow-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                {userProfile.profileImage}
              </div>
              <div>
                <h1 className="font-bold text-lg">{userProfile.name}</h1>
                <p className="text-sm text-gray-600">가족과 함께 성장중 🌱</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{userProfile.tokens}</div>
                  <div className="text-xs text-gray-600">토큰</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{userProfile.completedActivities}</div>
                  <div className="text-xs text-gray-600">활동</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* My Rewards */}
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <h3 className="text-sm font-medium text-purple-700 mb-2">내가 등록한 보상</h3>
            <div className="flex flex-wrap gap-2">
              {userProfile.myRewards.map((reward, index) => (
                <span key={index} className="px-2 py-1 bg-purple-200 text-purple-800 text-xs rounded-full">
                  {reward}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b max-w-md mx-auto">
        <div className="flex">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-3 text-center font-medium ${
              activeTab === 'feed' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600'
            }`}
          >
            실시간 칭찬
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-3 text-center font-medium ${
              activeTab === 'leaderboard' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600'
            }`}
          >
            순위표
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-md mx-auto pb-20">
        {activeTab === 'feed' ? (
          /* Live Feed */
          <div className="p-4 space-y-3">
            <h2 className="text-lg font-semibold mb-4">🔥 실시간 칭찬 현황</h2>
            {liveFeed.map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-blue-600">{item.from}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-green-600">{item.to}</span>
                  </div>
                  <span className={`text-xs font-medium ${getStatusColor(item.status)}`}>
                    {item.status === 'approved' ? '승인됨' : '대기중'}
                  </span>
                </div>
                <p className="text-gray-800 mb-2">"{item.message}"</p>
                <span className="text-xs text-gray-500">{item.time}</span>
              </div>
            ))}
          </div>
        ) : (
          /* Leaderboard */
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">🏆 가족 순위표</h2>
            <div className="space-y-2">
              {leaderboard.map((member, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`text-xl font-bold ${getRankColor(member.rank)}`}>
                      {member.rank}위
                    </div>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-gray-600">
                        활동 {member.activities}회 완료
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">{member.tokens}</div>
                    <div className="text-xs text-gray-600">토큰</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-md mx-auto">
          <div className="flex justify-around py-2">
            {[
              { id: 'write', icon: '✏️', label: '작성하기' },
              { id: 'compliments', icon: '💝', label: '칭찬보기' },
              { id: 'notifications', icon: '🔔', label: '알림' },
              { id: 'activities', icon: '🎯', label: '활동보기' },
              { id: 'my', icon: '👤', label: 'MY' }
            ].map((nav) => (
              <button
                key={nav.id}
                onClick={() => setActiveNav(nav.id)}
                className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                  activeNav === nav.id 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-600'
                }`}
              >
                <span className="text-lg mb-1">{nav.icon}</span>
                <span className="text-xs font-medium">{nav.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainScreen;