import { useState } from 'react';

function FamilyCodeInput() {
  const [familyCode, setFamilyCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    console.log('버튼 클릭됨:', familyCode);
    
    if (!familyCode.trim()) {
      setError('가족 코드를 입력해주세요.');
      return;
    }
    
    if (familyCode.length < 6) {
      setError('가족 코드는 6자리 이상이어야 합니다.');
      return;
    }

    if (familyCode === 'TEST123') {
      setError('');
      alert('성공! 가족 코드가 확인되었습니다.');
    } else {
      setError('올바르지 않은 가족 코드입니다.');
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          가족 코드 입력
        </h1>
        
        <div className="mb-4">
          <input
            type="text"
            value={familyCode}
            onChange={(e) => setFamilyCode(e.target.value)}
            placeholder="가족 코드를 입력하세요"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 rounded">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          확인
        </button>

        <div className="mt-4 text-sm text-gray-600">
          테스트 코드: TEST123
        </div>
      </div>
    </div>
  );
}

export default FamilyCodeInput;