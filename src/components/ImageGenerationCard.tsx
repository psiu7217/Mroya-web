import React, {useEffect, useState} from 'react';
import {tr} from '../i18n';
import {estimateImageGenerationProgress} from '../utils/imageGeneration';

export function ImageGenerationCard({phase}:{phase:'generating'|'finishing'}){
  const [estimated, setEstimated] = useState(() => estimateImageGenerationProgress(0));
  const generating = phase === 'generating';
  const progress = generating ? estimated : 100;
  const label = tr(generating ? 'imageGenerating' : 'imageFinishing', {ns:'chat'});

  useEffect(() => {
    if (!generating) return;
    const startedAt = performance.now();
    setEstimated(estimateImageGenerationProgress(0));
    const timer = window.setInterval(() => {
      setEstimated(estimateImageGenerationProgress(performance.now() - startedAt));
    }, 500);
    return () => window.clearInterval(timer);
  }, [generating]);

  return (
    <div className="mroya-image-generation relative isolate flex aspect-[4/3] w-full max-w-[34rem] items-end overflow-hidden rounded-xl" data-phase={phase}>
      <div className="mroya-image-generation-wave" aria-hidden="true" />
      <div className="mroya-image-generation-footer relative w-full space-y-2 px-4 pb-4 pt-7">
        <div className="flex items-baseline justify-between gap-3 text-sm font-medium">
          <p role="status">{label}</p>
          <span className="tabular-nums" aria-hidden="true">{generating ? '≈ ' : ''}{progress}%</span>
        </div>
        <div className="mroya-image-generation-track h-1 overflow-hidden rounded-full" role="progressbar"
          aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
          aria-valuetext={generating ? tr('imageProgressEstimate', {ns:'chat', progress}) : '100%'}>
          <div className="mroya-image-generation-fill h-full rounded-full" style={{width:`${progress}%`}} />
        </div>
      </div>
    </div>
  );
}
