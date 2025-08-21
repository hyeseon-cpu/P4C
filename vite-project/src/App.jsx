import { useEffect, useMemo, useState } from 'react'

// ------------------------------------------------------------
// Simple helpers
// ------------------------------------------------------------
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const STORAGE_KEY = 'family-app-state-v1'

const defaultMembers = [
  { id: 'mom', name: '엄마', role: 'Mom', avatar: '👩‍👧', cumulativeHearts: 0, cumulativeThumbs: 0, balanceTokens: 0, exchangeCount: 0 },
  { id: 'dad', name: '아빠', role: 'Dad', avatar: '👨‍👧', cumulativeHearts: 0, cumulativeThumbs: 0, balanceTokens: 0, exchangeCount: 0 },
  { id: 'daughter', name: '딸', role: 'Daughter', avatar: '👧', cumulativeHearts: 0, cumulativeThumbs: 0, balanceTokens: 0, exchangeCount: 0 },
]

const defaultState = {
  flowStep: 'setup/family-code', // setup/family-code -> setup/role -> setup/reward -> setup/negotiate -> setup/done -> onboarding -> main
  currentUserId: defaultMembers[0].id,
  family: {
    code: '',
    members: defaultMembers,
    rewards: [], // {id, authorId, text, proposals: {memberId: number}, finalTokens?: number}
    compliments: [], // {id, fromId, toId, message, status: 'pending'|'approved'|'rejected', feedback?: string, ts}
    activities: [], // {id, rewardId, exchangedById, ts}
    notifications: [], // {id, toId, message, ts, read: boolean}
  },
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('Failed to load state', e)
  }
  return defaultState
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save state', e)
  }
}

// ------------------------------------------------------------
// Root App
// ------------------------------------------------------------
export default function App() {
  const [state, setState] = useState(loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  const members = state.family.members
  const currentUser = members.find((m) => m.id === state.currentUserId) || members[0]

  // ------------------ Actions ------------------
  const setFlow = (flowStep) => setState((s) => ({ ...s, flowStep }))
  const setFamilyCode = (code) =>
    setState((s) => ({ ...s, family: { ...s.family, code } }))
  const setCurrentUser = (id) => setState((s) => ({ ...s, currentUserId: id }))

  // Reset to initial setup flow
  const resetToInitialFlow = () => {
    try {
      const fresh = JSON.parse(JSON.stringify(defaultState))
      setState(fresh)
    } catch (e) {
      setState({ ...defaultState })
    }
  }

  const addReward = (text) => {
    const id = uid()
    const reward = { id, authorId: state.currentUserId, text, proposals: {} }
    setState((s) => ({
      ...s,
      family: {
        ...s.family,
        rewards: [...s.family.rewards, reward],
        notifications: [
          { id: uid(), toId: 'ALL', message: `새 보상이 등록되었어요: "${text}"`, ts: Date.now(), read: false, type: 'new-reward', rewardId: id },
          ...s.family.notifications,
        ],
      },
    }))
  }

  const setProposal = (rewardId, memberId, value) => {
    const numeric = Number(value)
    setState((s) => {
      const memberIds = s.family.members.map((m) => m.id)
      const rewards = s.family.rewards.map((r) => {
        if (r.id !== rewardId) return r
        const updated = { ...r, proposals: { ...r.proposals, [memberId]: numeric } }
        const allProposed = memberIds.every((id) => typeof updated.proposals[id] === 'number' && !Number.isNaN(updated.proposals[id]))
        if (allProposed) {
          const sum = memberIds.reduce((acc, id) => acc + Number(updated.proposals[id]), 0)
          const avg = Math.round(sum / memberIds.length)
          return { ...updated, finalTokens: avg }
        }
        return updated
      })
      return { ...s, family: { ...s.family, rewards } }
    })
  }

  const finalizeRewardIfReady = (rewardId) => {
    setState((s) => {
      const r = s.family.rewards.find((x) => x.id === rewardId)
      if (!r) return s
      const memberIds = s.family.members.map((m) => m.id)
      const allProposed = memberIds.every((id) => typeof r.proposals[id] === 'number' && !Number.isNaN(r.proposals[id]))
      if (!allProposed) return s
      const sum = memberIds.reduce((acc, id) => acc + Number(r.proposals[id]), 0)
      const avg = Math.round(sum / memberIds.length)
      return {
        ...s,
        family: {
          ...s.family,
          rewards: s.family.rewards.map((x) => (x.id === rewardId ? { ...x, finalTokens: avg } : x)),
        },
      }
    })
  }

  const allRewardsFinalized = useMemo(() => state.family.rewards.length > 0 && state.family.rewards.every((r) => typeof r.finalTokens === 'number'), [state.family.rewards])

  const sendCompliment = (toId, message) => {
    const id = uid()
    const item = { id, fromId: state.currentUserId, toId, message, status: 'pending', ts: Date.now() }
    setState((s) => ({
      ...s,
      family: {
        ...s.family,
        compliments: [item, ...s.family.compliments],
        notifications: [
          { id: uid(), toId, message: '새 칭찬이 도착했어요 ✨', ts: Date.now(), read: false },
          ...s.family.notifications,
        ],
      },
    }))
  }

  const approveCompliment = (complimentId) => {
    setState((s) => {
      const c = s.family.compliments.find((x) => x.id === complimentId)
      if (!c) return s
      // award both sides 1 token
      const addToken = (m, isFrom, isTo) => {
        if (m.id === c.fromId) {
          return { ...m, cumulativeHearts: m.cumulativeHearts + 1, balanceTokens: m.balanceTokens + 1 }
        }
        if (m.id === c.toId) {
          return { ...m, cumulativeThumbs: m.cumulativeThumbs + 1, balanceTokens: m.balanceTokens + 1 }
        }
        return m
      }
      return {
        ...s,
        family: {
          ...s.family,
          members: s.family.members.map(addToken),
          compliments: s.family.compliments.map((x) => (x.id === complimentId ? { ...x, status: 'approved' } : x)),
          notifications: [
            { id: uid(), toId: c.fromId, message: '칭찬이 승인되었어요 ✅', ts: Date.now(), read: false },
            { id: uid(), toId: c.toId, message: '칭찬을 승인했어요 👍', ts: Date.now(), read: false },
            ...s.family.notifications,
          ],
        },
      }
    })
  }

  const rejectCompliment = (complimentId, feedback) => {
    setState((s) => {
      const c = s.family.compliments.find((x) => x.id === complimentId)
      if (!c) return s
      return {
        ...s,
        family: {
          ...s.family,
          compliments: s.family.compliments.map((x) => (x.id === complimentId ? { ...x, status: 'rejected', feedback } : x)),
          notifications: [
            { id: uid(), toId: c.fromId, message: '칭찬이 거절되었어요. 수정해서 다시 보내주세요 ✏️', ts: Date.now(), read: false },
            ...s.family.notifications,
          ],
        },
      }
    })
  }

  const exchangeReward = (rewardId) => {
    setState((s) => {
      const r = s.family.rewards.find((x) => x.id === rewardId)
      if (!r || typeof r.finalTokens !== 'number') return s
      const me = s.family.members.find((m) => m.id === s.currentUserId)
      if (!me || me.balanceTokens < r.finalTokens) return s
      const updatedMembers = s.family.members.map((m) => (m.id === me.id ? { ...m, balanceTokens: m.balanceTokens - r.finalTokens, exchangeCount: m.exchangeCount + 1 } : m))
      return {
        ...s,
        family: {
          ...s.family,
          members: updatedMembers,
          activities: [ { id: uid(), rewardId, exchangedById: me.id, ts: Date.now() }, ...s.family.activities ],
          notifications: [
            { id: uid(), toId: 'ALL', message: `Join family activity: "${r.text}" 🎉`, ts: Date.now(), read: false },
            ...s.family.notifications,
          ],
        },
      }
    })
  }

  // Demo: quick-fill others (dev helper)
  const quickFillOthers = () => {
    // ensure each member has a reward
    setState((s) => {
      let rewards = [...s.family.rewards]
      s.family.members.forEach((m) => {
        if (!rewards.some((r) => r.authorId === m.id)) {
          rewards.push({ id: uid(), authorId: m.id, text: `${m.name}와(과) 캠핑 가기`, proposals: {} })
        }
      })
      return { ...s, family: { ...s.family, rewards } }
    })
    // propose tokens randomly for any missing proposal and finalize
    setState((s) => {
      const memberIds = s.family.members.map((m) => m.id)
      const rewards = s.family.rewards.map((r) => {
        const proposals = { ...r.proposals }
        memberIds.forEach((id) => {
          if (typeof proposals[id] !== 'number') proposals[id] = Math.floor(5 + Math.random() * 6) // 5~10
        })
        const avg = Math.round(memberIds.reduce((acc, id) => acc + proposals[id], 0) / memberIds.length)
        return { ...r, proposals, finalTokens: avg }
      })
      return { ...s, family: { ...s.family, rewards } }
    })
  }

  // Leaderboard computed
  const leaderboard = useMemo(() => {
    return [...members]
      .map((m) => ({ ...m, totalTokens: m.balanceTokens }))
      .sort((a, b) => (b.exchangeCount - a.exchangeCount) || (b.totalTokens - a.totalTokens))
  }, [members])

  // Compliment live feed sorted by latest
  const complimentFeed = useMemo(() => {
    return [...state.family.compliments].sort((a, b) => b.ts - a.ts)
  }, [state.family.compliments])

  // ------------------ Rendering ------------------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        currentUser={currentUser}
        members={members}
        onSwitchUser={setCurrentUser}
        onQuickFill={quickFillOthers}
        onReset={resetToInitialFlow}
      />

      <div className="max-w-3xl mx-auto p-4">
        {state.flowStep.startsWith('setup/') && (
          <InitialSetupRouter
            state={state}
            setFlow={setFlow}
            setFamilyCode={setFamilyCode}
            addReward={addReward}
            setProposal={setProposal}
            finalizeRewardIfReady={finalizeRewardIfReady}
            allRewardsFinalized={allRewardsFinalized}
          />
        )}

        {state.flowStep === 'onboarding' && (
          <Onboarding onDone={() => setFlow('main')} />
        )}

        {state.flowStep === 'main' && (
          <MainScreen
            state={state}
            currentUser={currentUser}
            members={members}
            leaderboard={leaderboard}
            complimentFeed={complimentFeed}
            onSendCompliment={sendCompliment}
            onApprove={approveCompliment}
            onReject={rejectCompliment}
            onExchange={exchangeReward}
            onAddReward={addReward}
            onSetProposal={setProposal}
          />
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Top Bar
// ------------------------------------------------------------
function TopBar({ currentUser, members, onSwitchUser, onQuickFill, onReset }) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-3xl mx-auto flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{currentUser.avatar}</span>
          <div>
            <div className="text-sm text-slate-500">현재 사용자</div>
            <div className="font-semibold">{currentUser.name} ({currentUser.role})</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-2 py-1 rounded border border-slate-300"
            value={currentUser.id}
            onChange={(e) => onSwitchUser(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button className="text-xs px-2 py-1 rounded bg-slate-100 border" onClick={onQuickFill}>
            데모 채우기
          </button>
          <button className="text-xs px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700" onClick={onReset}>
            초기화면으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Initial Setup Flow
// ------------------------------------------------------------
function InitialSetupRouter({ state, setFlow, setFamilyCode, addReward, setProposal, finalizeRewardIfReady, allRewardsFinalized }) {
  if (state.flowStep === 'setup/family-code') return <FamilyCodeInput setFamilyCode={setFamilyCode} onNext={() => setFlow('setup/role')} />
  if (state.flowStep === 'setup/role') return <RoleSelection members={state.family.members} currentUserId={state.currentUserId} onNext={() => setFlow('setup/reward')} />
  if (state.flowStep === 'setup/reward') return <RewardDefinition rewards={state.family.rewards} addReward={addReward} onNext={() => setFlow('setup/propose')} members={state.family.members} />
  if (state.flowStep === 'setup/propose') return <TokenProposal family={state.family} currentUserId={state.currentUserId} setProposal={setProposal} onNext={() => setFlow('setup/negotiate')} />
  if (state.flowStep === 'setup/negotiate') return <TokenReveal family={state.family} finalizeReward={finalizeRewardIfReady} allRewardsFinalized={allRewardsFinalized} onNext={() => setFlow('setup/done')} />
  if (state.flowStep === 'setup/done') return <SetupComplete onNext={() => setFlow('onboarding')} />
  return null
}

function Card({ children, header, footer }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {header && <div className="px-4 py-3 border-b bg-slate-50 text-sm font-semibold">{header}</div>}
      <div className="p-4">{children}</div>
      {footer && <div className="px-4 py-3 border-t bg-slate-50">{footer}</div>}
    </div>
  )
}

function FamilyCodeInput({ setFamilyCode, onNext }) {
  const [code, setCode] = useState('')
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">초기 설정 · 가족 코드 입력</h1>
      <Card header="가족 코드">
        <div className="space-y-3">
          <input className="w-full px-3 py-2 border rounded" placeholder="가족 코드를 입력하세요" value={code} onChange={(e) => setCode(e.target.value)} />
          <button
            className="w-full bg-indigo-600 text-white py-2 rounded font-semibold disabled:opacity-50"
            disabled={!code}
            onClick={() => { setFamilyCode(code); onNext() }}
          >
            확인하고 다음으로
          </button>
        </div>
      </Card>
    </div>
  )
}

function RoleSelection({ members, currentUserId, onNext }) {
  const [selected, setSelected] = useState(currentUserId)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">초기 설정 · 역할 선택</h1>
      <Card>
        <div className="grid grid-cols-3 gap-3">
          {members.map((m) => (
            <label key={m.id} className={`border rounded-xl p-3 cursor-pointer flex flex-col items-center gap-2 ${selected===m.id?'border-indigo-500 ring-2 ring-indigo-200':''}`}>
              <span className="text-3xl">{m.avatar}</span>
              <span className="font-semibold">{m.name}</span>
              <input type="radio" name="role" className="hidden" checked={selected===m.id} onChange={() => setSelected(m.id)} />
            </label>
          ))}
        </div>
        <div className="mt-4">
          <button className="w-full bg-indigo-600 text-white py-2 rounded font-semibold" onClick={onNext}>선택 완료</button>
        </div>
      </Card>
    </div>
  )
}

function RewardDefinition({ rewards, addReward, onNext, members }) {
  const [text, setText] = useState('')
  const byAuthor = (authorId) => rewards.find((r) => r.authorId === authorId)
  const everyoneDone = members.every((m) => byAuthor(m.id))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">초기 설정 · 보상 등록</h1>
      <Card header="보상 작성">
        <div className="space-y-3">
          <input className="w-full px-3 py-2 border rounded" placeholder="나는 가족들과 ~~ 하고 싶어요" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="w-full bg-indigo-600 text-white py-2 rounded font-semibold disabled:opacity-50" disabled={!text} onClick={() => { addReward(text); setText('') }}>보상 추가</button>
        </div>
      </Card>
      <Card header="Reward Board">
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="flex items-center gap-2"><span className="text-xl">{m.avatar}</span><span className="font-medium">{m.name}</span></div>
              <div className="text-sm">
                {byAuthor(m.id) ? <span className="text-emerald-600 font-semibold">등록 완료</span> : <span className="text-slate-500">작성중…</span>}
              </div>
            </div>
          ))}
          {rewards.length===0 && <div className="text-slate-500 text-sm">아직 등록된 보상이 없어요.</div>}
        </div>
      </Card>
      <button className="w-full bg-indigo-600 text-white py-2 rounded font-semibold disabled:opacity-50" disabled={!everyoneDone} onClick={onNext}>모두 작성 완료 · 다음</button>
    </div>
  )
}

function TokenProposal({ family, currentUserId, setProposal, onNext }) {
  const allFilled = family.rewards.length > 0 && family.rewards.every((r) => typeof r.proposals[currentUserId] === 'number' && !Number.isNaN(r.proposals[currentUserId]))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">초기 설정 · 내 토큰 제안 제출</h1>
      {family.rewards.map((r) => (
        <Card key={r.id} header={`보상: "${r.text}"`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600">내가 생각하는 필요한 토큰 수</div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} className="w-24 px-2 py-1 border rounded text-right" value={r.proposals[currentUserId] ?? ''} onChange={(e) => setProposal(r.id, currentUserId, e.target.value)} />
              <span className="text-sm text-slate-500">토큰</span>
            </div>
          </div>
        </Card>
      ))}
      <div className="text-xs text-slate-500">각 구성원은 자신의 제안만 입력할 수 있어요. 상단에서 사용자 전환으로 다른 구성원 제안도 입력할 수 있습니다.</div>
      <button className="w-full bg-indigo-600 text-white py-2 rounded font-semibold disabled:opacity-50" disabled={!allFilled} onClick={onNext}>제출 완료 · 다음</button>
    </div>
  )
}

function TokenReveal({ family, finalizeReward, allRewardsFinalized, onNext }) {
  const memberIds = family.members.map((m) => m.id)
  const allProposedForAllRewards = family.rewards.length > 0 && family.rewards.every((r) => memberIds.every((id) => typeof r.proposals[id] === 'number' && !Number.isNaN(r.proposals[id])))
  const revealAll = () => {
    family.rewards.forEach((r) => finalizeReward(r.id))
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">초기 설정 · 최종 토큰 공개</h1>
      {family.rewards.map((r) => (
        <Card key={r.id} header={`보상: "${r.text}"`}>
          <div className="space-y-2">
            <div className="text-sm text-slate-600">제출 현황: {memberIds.filter((id)=> typeof r.proposals[id] === 'number').length} / {memberIds.length}</div>
            {typeof r.finalTokens === 'number' ? (
              <div className="mt-1 text-emerald-700 font-semibold">최종 교환 토큰 수: {r.finalTokens}개</div>
            ) : (
              <div className="text-xs text-slate-500">모든 구성원이 제출하면 토큰 수를 공개할 수 있어요.</div>
            )}
          </div>
        </Card>
      ))}
      {!allRewardsFinalized && (
        <button className="w-full bg-slate-900 text-white py-2 rounded font-semibold disabled:opacity-50" disabled={!allProposedForAllRewards} onClick={revealAll}>토큰개수 확인</button>
      )}
      <button className="w-full bg-indigo-600 text-white py-2 rounded font-semibold disabled:opacity-50" disabled={!allRewardsFinalized} onClick={onNext}>다음</button>
    </div>
  )
}

function authorName(members, id) {
  return members.find((m) => m.id === id)?.name ?? '구성원'
}

function SetupComplete({ onNext }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-2">🎉</div>
        <h1 className="text-2xl font-bold">좋아요! 모든 활동이 등록되었어요</h1>
        <p className="text-slate-600 mt-2">이제 간단한 안내를 보고 메인으로 이동해요.</p>
      </div>
      <button className="w-full bg-indigo-600 text-white py-2 rounded font-semibold" onClick={onNext}>온보딩 보기</button>
    </div>
  )
}

// ------------------------------------------------------------
// Onboarding
// ------------------------------------------------------------
function Onboarding({ onDone }) {
  const slides = [
    { title: '칭찬하면 하트, 받으면 엄지척', body: '서로 칭찬하면 스티커를 모을 수 있어요.' },
    { title: '스티커 → 토큰 → 보상 교환', body: '보상에 필요한 토큰 수를 채우면 교환할 수 있어요.' },
    { title: '피드백 & 승인', body: '칭찬이 마음에 들지 않으면 이유와 함께 거절하고 수정 요청할 수 있어요.' },
    { title: '리더보드 & 라이브', body: '실시간 칭찬 현황과 순위를 확인해요. 순위는 활동 교환 수를 더 중요하게 봐요.' },
  ]
  const [idx, setIdx] = useState(0)
  const last = idx === slides.length - 1
  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{slides[idx].title}</h2>
          <p className="text-slate-600">{slides[idx].body}</p>
        </div>
      </Card>
      <div className="flex gap-2">
        <button className="flex-1 py-2 rounded border" onClick={onDone}>건너뛰기</button>
        {!last ? (
          <button className="flex-1 py-2 rounded bg-indigo-600 text-white" onClick={() => setIdx(idx+1)}>다음</button>
        ) : (
          <button className="flex-1 py-2 rounded bg-indigo-600 text-white" onClick={onDone}>시작하기</button>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Main Screen
// ------------------------------------------------------------
function MainScreen({ state, currentUser, members, leaderboard, complimentFeed, onSendCompliment, onApprove, onReject, onExchange, onAddReward, onSetProposal }) {
  const [tab, setTab] = useState('feed') // feed | board
  const [nav, setNav] = useState('home') // home | write | compliments | notifications | activities | my

  return (
    <div className="space-y-4">
      <HeaderSummary currentUser={currentUser} rewards={state.family.rewards} showMyRewards={nav === 'home' || nav === 'write'} />

      {/* pane switcher */}
      {nav === 'home' && (
        <>
          <div className="grid grid-cols-2 rounded-xl overflow-hidden border">
            <button className={`py-2 font-semibold ${tab==='feed'?'bg-slate-900 text-white':'bg-white'}`} onClick={() => setTab('feed')}>Compliment Live</button>
            <button className={`py-2 font-semibold ${tab==='board'?'bg-slate-900 text-white':'bg-white'}`} onClick={() => setTab('board')}>Token Leaderboard</button>
          </div>
          {tab === 'feed' ? (
            <ComplimentFeed
              feed={complimentFeed}
              members={members}
              currentUserId={currentUser.id}
              onApprove={onApprove}
              onReject={onReject}
            />
          ) : (
            <Leaderboard members={leaderboard} />
          )}
        </>
      )}

      {nav === 'write' && (
        <WritePanel members={members} currentUser={currentUser} onSendCompliment={onSendCompliment} rewards={state.family.rewards} onExchange={onExchange} onAddReward={onAddReward} />
      )}

      {nav === 'compliments' && (
        <MyCompliments feed={state.family.compliments} members={members} currentUserId={currentUser.id} />
      )}

      {nav === 'notifications' && (
        <Notifications items={state.family.notifications} currentUserId={currentUser.id} onGoActivities={() => setNav('activities')} />
      )}

      {nav === 'activities' && (
        <Activities activities={state.family.activities} rewards={state.family.rewards} members={members} onExchange={onExchange} currentUserId={currentUser.id} onPropose={(rewardId, value)=> onSetProposal(rewardId, currentUser.id, value)} />
      )}

      {nav === 'my' && (
        <MyPage family={state.family} currentUser={currentUser} />
      )}

      <BottomNav value={nav} onChange={setNav} />
    </div>
  )
}

function HeaderSummary({ currentUser, rewards, showMyRewards }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{currentUser.avatar}</span>
          <div>
            <div className="font-semibold">{currentUser.name}</div>
            <div className="text-sm text-slate-500">역할: {currentUser.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-center">
          <div>
            <div className="text-xl font-bold">{currentUser.balanceTokens}</div>
            <div className="text-xs text-slate-500">보유 토큰</div>
          </div>
          <div>
            <div className="text-xl font-bold">{currentUser.exchangeCount}</div>
            <div className="text-xs text-slate-500">교환 수</div>
          </div>
          <div>
            <div className="text-xl font-bold">{rewards.filter((r)=>r.authorId===currentUser.id).length}</div>
            <div className="text-xs text-slate-500">등록 보상</div>
          </div>
        </div>
      </div>
      {showMyRewards && (
        <div className="mt-4 pt-4 border-t">
          <div className="font-semibold mb-2">내가 등록한 보상</div>
          <div className="space-y-2">
            {rewards.filter((r)=> r.authorId===currentUser.id).map((r)=>(
              <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.text}</div>
                  {typeof r.finalTokens === 'number' ? (
                    <div className="text-xs text-slate-500">최종 토큰: {r.finalTokens}</div>
                  ) : (
                    <div className="text-xs text-slate-500">아직 확정 전</div>
                  )}
                </div>
              </div>
            ))}
            {rewards.filter((r)=> r.authorId===currentUser.id).length===0 && (
              <div className="text-slate-500 text-sm">아직 내가 등록한 보상이 없어요.</div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function nameById(members, id) { return members.find((m)=>m.id===id)?.name ?? '—' }

function ComplimentFeed({ feed, members, currentUserId, onApprove, onReject }) {
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  return (
    <div className="space-y-3">
      {feed.map((c) => (
        <Card key={c.id}>
          <div className="flex items-center justify-between text-sm">
            <div className="font-medium">
              From <span className="text-slate-700">{nameById(members, c.fromId)}</span> → To <span className="text-slate-700">{nameById(members, c.toId)}</span>
            </div>
            <div className="text-xs text-slate-500">{new Date(c.ts).toLocaleString()}</div>
          </div>
          <div className="mt-2">{c.message}</div>
          <div className="mt-3 flex items-center gap-2">
            {c.status === 'pending' && c.toId === currentUserId && (
              <>
                <button className="px-3 py-1 rounded bg-emerald-600 text-white text-sm" onClick={() => onApprove(c.id)}>승인</button>
                {rejectingId === c.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input className="flex-1 px-2 py-1 border rounded" placeholder="거절 사유" value={reason} onChange={(e)=>setReason(e.target.value)} />
                    <button className="px-3 py-1 rounded border" onClick={()=>{ onReject(c.id, reason||''); setRejectingId(null); setReason('') }}>확인</button>
                  </div>
                ) : (
                  <button className="px-3 py-1 rounded border text-sm" onClick={() => setRejectingId(c.id)}>거절</button>
                )}
              </>
            )}
            {c.status !== 'pending' && (
              <span className={`text-xs px-2 py-1 rounded ${c.status==='approved'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>{c.status}</span>
            )}
            {c.status==='rejected' && c.feedback && (
              <span className="text-xs text-slate-500">이유: {c.feedback}</span>
            )}
          </div>
        </Card>
      ))}
      {feed.length===0 && <div className="text-slate-500 text-sm">아직 칭찬이 없어요.</div>}
    </div>
  )}

function Leaderboard({ members }) {
  return (
    <Card header="Compliment Token Leaderboard">
      <div className="space-y-2">
        {members.map((m, i) => (
          <div key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xl">{i===0?'🥇':i===1?'🥈':i===2?'🥉':'🏅'}</span>
              <span className="text-2xl">{m.avatar}</span>
              <span className="font-semibold">{m.name}</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-bold">{m.exchangeCount}</div>
                <div className="text-slate-500">교환 수</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{m.balanceTokens}</div>
                <div className="text-slate-500">보유 토큰</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500 mt-3">정렬 규칙: 활동 교환 수 우선 → 보유 토큰</div>
    </Card>
  )
}

function WritePanel({ members, currentUser, onSendCompliment, rewards, onExchange, onAddReward }) {
  const [toId, setToId] = useState(members.find((m)=>m.id!==currentUser.id)?.id || members[0].id)
  const [msg, setMsg] = useState('')
  const [newReward, setNewReward] = useState('')

  return (
    <div className="space-y-4">
      <Card header="칭찬하기">
        <div className="space-y-3">
          <select className="w-full px-3 py-2 border rounded" value={toId} onChange={(e)=>setToId(e.target.value)}>
            {members.filter((m)=>m.id!==currentUser.id).map((m)=>(<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
          <textarea className="w-full px-3 py-2 border rounded" rows={3} placeholder="메시지를 입력하세요" value={msg} onChange={(e)=>setMsg(e.target.value)} />
          <button className="w-full bg-indigo-600 text-white py-2 rounded font-semibold disabled:opacity-50" disabled={!msg} onClick={()=>{ onSendCompliment(toId, msg); setMsg('') }}>보내기</button>
        </div>
      </Card>

      <Card header="보상 작성하기">
        <div className="space-y-3">
          <input className="w-full px-3 py-2 border rounded" placeholder="나는 가족들과 ~~ 하고 싶어요" value={newReward} onChange={(e) => setNewReward(e.target.value)} />
          <button className="w-full bg-slate-900 text-white py-2 rounded font-semibold disabled:opacity-50" disabled={!newReward} onClick={() => { onAddReward(newReward); setNewReward('') }}>보상 추가</button>
        </div>
      </Card>

      <Card header="보상 교환">
        <div className="space-y-3">
          {rewards.filter((r)=> typeof r.finalTokens === 'number').map((r)=>(
            <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.text}</div>
                <div className="text-xs text-slate-500">필요 토큰: {r.finalTokens}</div>
              </div>
              <button className="px-3 py-1 rounded bg-slate-900 text-white text-sm" onClick={()=>onExchange(r.id)}>교환</button>
            </div>
          ))}
          {rewards.length===0 && <div className="text-slate-500 text-sm">아직 확정된 보상이 없어요.</div>}
        </div>
      </Card>
    </div>
  )
}

function MyCompliments({ feed, members, currentUserId }) {
  const mine = feed.filter((c)=> c.fromId===currentUserId || c.toId===currentUserId)
  return (
    <Card header="내 칭찬 내역">
      <div className="space-y-2">
        {mine.map((c)=>(
          <div key={c.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{c.message}</div>
              <div className="text-xs text-slate-500">From {nameById(members, c.fromId)} → To {nameById(members, c.toId)}</div>
            </div>
            <div className="text-xs">{c.status}</div>
          </div>
        ))}
        {mine.length===0 && <div className="text-slate-500 text-sm">기록이 없어요.</div>}
      </div>
    </Card>
  )
}

function Notifications({ items, currentUserId, onGoActivities }) {
  const list = items.filter((n)=> n.toId===currentUserId || n.toId==='ALL').sort((a,b)=>b.ts-a.ts)
  return (
    <Card header="알림">
      <div className="space-y-2">
        {list.map((n)=>(
          <button key={n.id} className="w-full text-left border rounded px-3 py-2 hover:bg-slate-50" onClick={() => { if (n.type==='new-reward') onGoActivities && onGoActivities() }}>
            <div className="min-w-0">
              <div className="font-medium truncate">{n.message}</div>
              <div className="text-xs text-slate-500">{new Date(n.ts).toLocaleString()}</div>
            </div>
          </button>
        ))}
        {list.length===0 && <div className="text-slate-500 text-sm">알림이 없습니다.</div>}
      </div>
    </Card>
  )
}

function Activities({ activities, rewards, members, onExchange, currentUserId, onPropose }) {
  const byId = Object.fromEntries(rewards.map((r)=>[r.id, r]))
  return (
    <div className="space-y-4">
      <Card header="내가 교환한 활동">
        <div className="space-y-2">
          {activities.map((a)=>(
            <div key={a.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{byId[a.rewardId]?.text ?? '활동'}</div>
                <div className="text-xs text-slate-500">{new Date(a.ts).toLocaleString()}</div>
              </div>
              <div className="text-xs text-slate-500">by {nameById(members, a.exchangedById)}</div>
            </div>
          ))}
          {activities.length===0 && <div className="text-slate-500 text-sm">아직 교환한 활동이 없어요.</div>}
        </div>
      </Card>

      <Card header="대기중인 보상">
        <div className="space-y-3">
          {rewards.filter((r)=> typeof r.finalTokens !== 'number').map((r)=>(
            <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.text}</div>
                <div className="text-xs text-slate-500">내 제안: {typeof r.proposals[currentUserId] === 'number' ? r.proposals[currentUserId] : '미입력'}</div>
              </div>
              <OpenProposalDialog reward={r} members={members} currentUserId={currentUserId} onPropose={onPropose} />
            </div>
          ))}
          {rewards.filter((r)=> typeof r.finalTokens !== 'number').length===0 && <div className="text-slate-500 text-sm">대기중인 보상이 없어요.</div>}
        </div>
      </Card>

      <Card header="보상 교환">
        <div className="space-y-3">
          {rewards.filter((r)=> typeof r.finalTokens === 'number').map((r)=>(
            <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.text}</div>
                <div className="text-xs text-slate-500">필요 토큰: {r.finalTokens}</div>
              </div>
              <button className="px-3 py-1 rounded bg-slate-900 text-white text-sm" onClick={()=>onExchange(r.id)}>교환</button>
            </div>
          ))}
          {rewards.length===0 && <div className="text-slate-500 text-sm">아직 확정된 보상이 없어요.</div>}
        </div>
      </Card>
    </div>
  )
}

function OpenProposalDialog({ reward, members, currentUserId, onPropose }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(typeof reward.proposals[currentUserId] === 'number' ? reward.proposals[currentUserId] : '')
  const allSubmittedCount = members.filter((m)=> typeof reward.proposals[m.id] === 'number').length
  return (
    <>
      <button className="px-3 py-1 rounded border text-sm" onClick={()=>setOpen(true)}>토큰 수 등록하기</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
            <div className="font-semibold mb-2">보상: {reward.text}</div>
            <div className="space-y-3">
              <div className="text-sm text-slate-600">내가 생각하는 필요한 토큰 수</div>
              <input type="number" min={0} className="w-full px-3 py-2 border rounded" value={value} onChange={(e)=>setValue(e.target.value)} />
              <div className="text-xs text-slate-500">제출 현황: {allSubmittedCount} / {members.length}</div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button className="flex-1 py-2 rounded border" onClick={()=>setOpen(false)}>취소</button>
              <button className="flex-1 py-2 rounded bg-indigo-600 text-white disabled:opacity-50" disabled={value==='' || Number.isNaN(Number(value))} onClick={()=>{ onPropose(reward.id, Number(value)); setOpen(false) }}>등록</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MyPage({ family, currentUser }) {
  return (
    <div className="space-y-3">
      <Card header="가족 코드">
        <div className="text-lg font-mono tracking-wider">{family.code || '—'}</div>
      </Card>
      <Card header="프로필">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{currentUser.avatar}</div>
          <div>
            <div className="font-semibold">{currentUser.name}</div>
            <div className="text-sm text-slate-500">{currentUser.role}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <div>
            <div className="text-xl font-bold">{currentUser.cumulativeHearts}</div>
            <div className="text-xs text-slate-500">하트(보낸 칭찬)</div>
          </div>
          <div>
            <div className="text-xl font-bold">{currentUser.cumulativeThumbs}</div>
            <div className="text-xs text-slate-500">엄지척(받은 칭찬)</div>
          </div>
          <div>
            <div className="text-xl font-bold">{currentUser.balanceTokens}</div>
            <div className="text-xs text-slate-500">보유 토큰</div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function BottomNav({ value, onChange }) {
  const Item = ({ id, label }) => (
    <button className={`flex-1 py-2 text-sm ${value===id?'text-indigo-600 font-semibold':'text-slate-600'}`} onClick={()=>onChange(id)}>{label}</button>
  )
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t">
      <div className="max-w-3xl mx-auto flex">
        <Item id="home" label="홈" />
        <Item id="write" label="작성하기" />
        <Item id="compliments" label="칭찬 보기" />
        <Item id="notifications" label="알림" />
        <Item id="activities" label="활동 보기" />
        <Item id="my" label="MY" />
      </div>
    </div>
  )
}
