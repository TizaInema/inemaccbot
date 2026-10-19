import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

import agnes_story as story
import agnes_video as video
from agnes_narration import revisar


class AgnesTests(unittest.TestCase):
    def test_long_image_animation_joins_clips_without_generating_images(self):
        with tempfile.TemporaryDirectory() as tmp:
            image=Path(tmp)/'photo.png'; image.write_bytes(b'image')
            spec=Path(tmp)/'spec.json'; spec.write_text(json.dumps({'image':str(image),'seconds':15,'ratio':'1:1'}))
            output=Path(tmp)/'out.mp4'; bodies=[]
            def clip(path,row,save,body):
                bodies.append(body); path.write_bytes(b'clip')
            with patch.object(video,'api_key',return_value='test'), \
                 patch.object(video,'image_reference',return_value='data:image/png;base64,test'), \
                 patch.object(video,'generate_clip',side_effect=clip), \
                 patch.object(video,'normalize_clip',side_effect=lambda a,p,*args:p.write_bytes(b'normalized')), \
                 patch.object(video,'concatenate') as assemble, patch.object(video,'run'):
                video.animate(spec,output)
            self.assertEqual(len(bodies),2)
            self.assertEqual(bodies[0]['seconds'],'8')
            self.assertIn('last_frame',bodies[0]); self.assertNotIn('last_frame',bodies[1])
            self.assertEqual(assemble.call_args.args[-1],15)

    def test_keyframe_payload_matches_current_api(self):
        with patch.object(video,'image_reference',side_effect=lambda p:'data:image/png;base64,'+str(p)):
            body=video.video_payload('first','Slow camera movement',8,'9:16','last')
        self.assertEqual(body['model'],'agnes-video-2.5-flash')
        self.assertEqual(body['seconds'],'8')
        self.assertEqual(body['mode'],'keyframe')
        self.assertIn('last_frame',body)
        self.assertFalse({'num_frames','frame_rate','width','height'} & set(body))

    def test_rejected_creation_retries_but_keeps_both_ids(self):
        row={}; saved=[]
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'clip.mp4'
            responses=[video.ApiError(503), {'id':'task-test','video_id':'video-test'},
                       {'status':'completed','url':'https://example.org/clip.mp4'}]
            with patch.object(video,'request',side_effect=responses) as request, \
                 patch.object(video.time,'sleep') as sleep, \
                 patch.object(video,'download_video',side_effect=lambda u,p:p.write_bytes(b'clip')):
                video.generate_clip(path,row,lambda:saved.append(dict(row)),{})
            self.assertEqual(row['task_id'],'task-test'); self.assertEqual(row['video_id'],'video-test')
            self.assertEqual(request.call_args_list[-1].args[1],'/agnesapi?video_id=video-test&model_name=agnes-video-2.5-flash')
            self.assertTrue(saved); sleep.assert_called_once()

    def test_timeout_resume_does_not_submit_another_video(self):
        row={}
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'clip.mp4'
            with patch.object(video,'request',return_value={'id':'task-test','video_id':'video-test'}) as request:
                with self.assertRaisesRegex(RuntimeError,'Retome'):
                    video.generate_clip(path,row,lambda:None,{},timeout=0)
                self.assertEqual(request.call_count,1)
            with patch.object(video,'request',return_value={'status':'completed','url':'https://example.org/clip.mp4'}) as request, \
                 patch.object(video,'download_video',side_effect=lambda u,p:p.write_bytes(b'clip')):
                video.generate_clip(path,row,lambda:None,{})
                self.assertTrue(all(c.args[0]=='GET' for c in request.call_args_list))

    def test_ambiguous_creation_is_not_retried(self):
        row={}
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'clip.mp4'
            with patch.object(video,'request',side_effect=RuntimeError('network timeout')) as request:
                with self.assertRaises(RuntimeError): video.generate_clip(path,row,lambda:None,{})
                with self.assertRaisesRegex(RuntimeError,'sem confirmação'): video.generate_clip(path,row,lambda:None,{})
                self.assertEqual(request.call_count,1)

    def test_legacy_status_fallback_uses_task_id_not_video_id(self):
        with patch.object(video,'request',side_effect=[video.ApiError(404),{'status':'queued'}]) as request:
            self.assertEqual(video.task_status({'video_id':'video-test','task_id':'task-test'})['status'],'queued')
            self.assertEqual(request.call_args.args[1],'/videos/task-test')

    def test_invalid_story_is_rejected_before_any_api_call(self):
        invalid={'anchors':[{'id':'one','prompt':'Robot'}],
                 'scenes':[{'image_prompt':'Robot','narration':'Olá','motion':'Wave','refs':['missing']}]}
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'spec.json'; path.write_text(json.dumps(invalid))
            with patch.object(story,'api_key') as key:
                with self.assertRaisesRegex(ValueError,'referências'): story.build(path,Path(tmp)/'out.mp4')
                key.assert_not_called()

    def test_changed_story_does_not_reuse_unrelated_clips(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'out.mp4'
            video.work_state({'story':'first'},output,'story')
            with self.assertRaisesRegex(ValueError,'roteiro mudou'):
                video.work_state({'story':'second'},output,'story')

    def test_failed_scene_never_produces_incomplete_movie(self):
        spec={'anchors':[{'id':'robot','prompt':'Small orange robot'}],
              'scenes':[{'image_prompt':'Robot in workshop','end_prompt':'Robot waves',
                         'narration':'Olá','motion':'Robot waves slowly','refs':['robot']}]}
        def generate(prompt,path,*args,**kwargs): path.write_bytes(b'image')
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'spec.json'; path.write_text(json.dumps(spec))
            with patch.object(story,'api_key',return_value='test'), \
                 patch.object(story,'generate',side_effect=generate) as images, \
                 patch.object(story,'tts',side_effect=lambda t,p:p.write_bytes(b'audio')), \
                 patch.object(story,'probe',return_value={'format':{'duration':'4'}}), \
                 patch.object(story,'video_payload',return_value={}), \
                 patch.object(story,'generate_clip',side_effect=RuntimeError('pending')), \
                 patch.object(story,'concatenate') as assemble:
                with self.assertRaises(RuntimeError): story.build(path,Path(tmp)/'out.mp4')
                assemble.assert_not_called()
                self.assertEqual(images.call_count,3)
                self.assertEqual(len(images.call_args_list[-1].kwargs['refs']),2)

    def test_error_never_echoes_authentication_url(self):
        error=urllib.error.HTTPError('https://example.org/?secret=do-not-print',401,'Unauthorized',{},io.BytesIO())
        with patch.object(video,'api_key',return_value='test'), patch.object(video.urllib.request,'urlopen',side_effect=error):
            with self.assertRaises(video.ApiError) as caught: video.request('GET','/models')
        self.assertNotIn('do-not-print',str(caught.exception))

    def test_narration_revision_preserves_words_and_expands_numbers(self):
        text,changes=revisar('vc tem 2 amigos')
        self.assertEqual(text,'você tem dois amigos'); self.assertTrue(changes)


if __name__=='__main__': unittest.main()
