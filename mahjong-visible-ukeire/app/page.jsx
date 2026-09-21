'use client';

import {useMemo, useState} from 'react';
import mahjongProblem from '../src/problem.cjs';

const {WINDS, labelTile, tileArt, createFixture, evaluate, candidateSummary} = mahjongProblem;

function TileFace({tile, small=false, sideways=false, upsideDown=false, concealed=false}) {
  const classes = ['tile', small ? 'tile-small' : 'tile-large', sideways ? 'tile-side' : '', upsideDown ? 'tile-opposite' : ''].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-hidden="true">
      <span className="tile-rotator">
        {concealed ? <img className="tile-image" src="/tiles/back.svg" alt="" draggable="false" /> : <>
          <img className="tile-image" src="/tiles/front.svg" alt="" draggable="false" />
          <img className="tile-image" src={tileArt(tile)} alt="" draggable="false" />
        </>}
      </span>
    </span>
  );
}
function OpponentHand({seat,meldCount=0}) {
  const count = 13 - 3 * meldCount;
  return <div className={`opponent-hand opponent-${seat}`} aria-label={`${WINDS[seat]}家の伏せ牌 ${count}枚`}>
    {Array.from({length:count},(_,i)=><TileFace key={i} concealed small sideways={seat==='left'||seat==='right'} upsideDown={seat==='top'} />)}
  </div>;
}
function River({seat,entries}) {
  return <div className={`river river-${seat}`} aria-label={`${WINDS[seat]}家の捨て牌 ${entries.length}枚`}>
    <span className="river-name">{WINDS[seat]}家の捨て牌</span>
    <div className="river-tiles">
      {entries.map(entry=><TileFace key={entry.id} tile={entry.tile} small sideways={seat==='left'||seat==='right'} upsideDown={seat==='top'} />)}
    </div>
  </div>;
}
function Seat({seat,score,active=false}) {
  return <div className={`seat seat-${seat} ${active?'seat-active':''}`}>
    <span>{WINDS[seat]}家</span><small>{score.toLocaleString()}点</small>
  </div>;
}
function Board({scene}) {
  return <section className="felt" aria-label="4人麻雀卓・公開情報">
    <div className="north-hand"><OpponentHand seat="top" /></div>
    <div className="north-river"><River seat="top" entries={scene.rivers.top}/></div>
    <div className="west-area">
      <Seat seat="left" score={scene.scores.left}/>
      <div className="side-pair">
        <OpponentHand seat="left" meldCount={scene.melds.filter(m=>m.seat==='left').length}/>
        <River seat="left" entries={scene.rivers.left}/>
      </div>
      {scene.melds.filter(m=>m.seat==='left').map(m=><div className="meld" key={m.id} aria-label="北家の公開副露 チー">
        <span className="meld-label">北家 チー</span>
        <div className="meld-tiles">{m.tiles.map(t=><TileFace key={t.id} tile={t.tile} small />)}</div>
      </div>)}
    </div>
    <div className="center-area">
      <div className="round-center">
        <div className="round-title">{scene.round}</div>
        <div className="round-info">{scene.honba}本場 · 自分の番</div>
        <div className="dora-label">ドラ表示牌</div>
        <div className="indicators">{scene.indicators.map(entry=><TileFace key={entry.id} tile={entry.tile} small />)}</div>
      </div>
    </div>
    <div className="east-area">
      <Seat seat="right" score={scene.scores.right}/>
      <div className="side-pair"><River seat="right" entries={scene.rivers.right}/><OpponentHand seat="right"/></div>
    </div>
    <div className="south-river"><River seat="self" entries={scene.rivers.self}/></div>
    <div className="south-seat"><Seat seat="self" score={scene.scores.self} active/></div>
  </section>;
}
function Result({scene,scored,selected,onClose,onRetry}) {
  const {candidate,correct,details}=candidateSummary(scored,scene,selected.tile);
  const winners=scored.candidates.filter(c=>scored.correctCandidateIds.includes(c.id));
  return <section className="answer-sheet" role="region" aria-label="回答結果">
    <div className="result-head">
      <div><span className={`verdict ${correct?'correct':'incorrect'}`}>{correct?'正解！':'惜しい！'}</span>
        <strong>{labelTile(selected.tile)}切り</strong></div>
      <button type="button" className="subtle-button" onClick={onClose}>卓を見る ↓</button>
    </div>
    <div className="result-main"><span>手牌のみ <strong>{candidate.baselineCount}枚</strong></span>
      <span className="result-arrow">→</span><span>見えていない受け入れ <strong>{candidate.visibleCount}枚</strong></span></div>
    <div className="result-winners"><strong>この局面の正解</strong>
      {winners.map(c=><span className="winner" key={c.id}><TileFace tile={c.tile} small/>{labelTile(c.tile)}切り・{c.visibleCount}枚</span>)}
    </div>
    <h2 className="breakdown-title">どの牌が何枚見えている？</h2>
    <div className="breakdown">
      {details.length ? details.map(d=><div key={d.tileIndex} className="breakdown-row">
        <TileFace tile={d.tile} small/>
        <span className="breakdown-name">{labelTile(d.tile)}<small>{d.location||'追加の公開牌なし'}</small></span>
        <span className="breakdown-amount">{d.baseline} − {d.publicVisible} = <strong>{d.remaining}枚</strong></span>
      </div>) : <p>この打牌に向聴数を改善する有効牌はありません。</p>}
    </div>
    <p className="result-note">数字は山の実枚数ではなく、自分の14枚と公開牌を除いた「見えていない枚数」です。点数・押し引きは判定に含みません。</p>
    <button type="button" className="retry" onClick={onRetry}>同じ問題をもう一度</button>
  </section>;
}
export default function HomePage() {
  const {scene,scored} = useMemo(()=>{
    const scene=createFixture();
    return {scene,scored:evaluate(scene)};
  },[]);
  const [selectedId,setSelectedId]=useState(null);
  const [zoom,setZoom]=useState(false);
  const [showResult,setShowResult]=useState(true);
  const selected=scene.hand.find(t=>t.id===selectedId);
  function answer(id) {if(selectedId===null){setSelectedId(id);setShowResult(true);}}
  function retry(){setSelectedId(null);setShowResult(true);setZoom(false);}
  return <main className="screen">
    <header className="header">
      <div><span className="eyebrow">実戦向け何切るトレーナー</span><h1>第1問 <small>画面検証用の固定問題</small></h1></div>
      <span className="status">{scene.round}　{scene.honba}本場</span>
    </header>
    <div className="board-region"><Board scene={scene}/></div>
    <section className="hand-section" aria-label="自分の手牌・回答欄">
      <div className="hand-heading"><div><strong>何を切る？</strong><span>{selected?'選んだ牌の結果を確認':'手牌を1枚タップして回答'}</span></div>
        <button type="button" className="zoom-button" onClick={()=>setZoom(v=>!v)} aria-pressed={zoom}>{zoom?'通常表示':'手牌を拡大'}</button>
      </div>
      <div className={`hand-tiles ${zoom?'hand-zoomed':''}`} role="group" aria-label="打牌する14枚">
        {scene.hand.map(({id,tile},i)=><button type="button" key={id} className={`discard-button ${selectedId===id?'is-selected':''} ${i===13?'drawn-tile':''}`} disabled={selectedId!==null}
          aria-label={`${labelTile(tile)}を切る`} aria-pressed={selectedId===id} onClick={()=>answer(id)}>
          <TileFace tile={tile}/>
        </button>)}
      </div>
    </section>
    <footer className="footer">{selected ? <button type="button" className="footer-action" onClick={()=>setShowResult(v=>!v)}>{showResult?'解説を閉じる':'解説を開く'}</button>
      : <span>4人の河・公開副露・ドラ表示牌を見て判断しよう</span>}</footer>
    {selected&&showResult&&<Result scene={scene} scored={scored} selected={selected} onClose={()=>setShowResult(false)} onRetry={retry}/>}
  </main>;
}
