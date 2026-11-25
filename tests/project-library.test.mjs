import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {normalizeRecentProjects,rememberRecentProject,readRecentProjects} from '../designer/core/recent-projects.mjs';
test('Library preserves all projects, rejects invalid entries and deduplicates',()=>{const roots=Array.from({length:30},(_,i)=>resolve('project-'+i));assert.deepEqual(normalizeRecentProjects([...roots,roots[0],null,'','bad\0path']),roots)});
test('Library persists project selection and puts latest first',async()=>{const dir=await mkdtemp(join(tmpdir(),'wset-library-'));try{const file=join(dir,'recent.json');assert.deepEqual(await readRecentProjects(file),[]);for(let i=0;i<12;i++)await rememberRecentProject(file,join(dir,String(i)));await rememberRecentProject(file,join(dir,'0'));const list=await readRecentProjects(file);assert.equal(list.length,12);assert.equal(list[0],join(dir,'0'));}finally{await rm(dir,{recursive:true,force:true})}});
