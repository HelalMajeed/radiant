/* Original optical sculpture. Native WebGL, no textures, video or dependencies. */
(() => {
  'use strict';
  const vertex = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aDetail;
    uniform vec2 uViewport;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uRibbon;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vLocal;
    varying vec3 vDetail;
    mat3 turn(float x,float y,float z) {
      float a=cos(x),b=sin(x),c=cos(y),d=sin(y),e=cos(z),f=sin(z);
      return mat3(e,f,0.,-f,e,0.,0.,0.,1.) * mat3(c,0.,-d,0.,1.,0.,d,0.,c) * mat3(1.,0.,0.,0.,a,b,0.,-b,a);
    }
    void main() {
      float t=uTime;
      mat3 r=turn(.18+sin(t*.11)*.12+uPointer.y*.08,t*.075+uPointer.x*.13,-.24+sin(t*.09)*.1);
      if(uRibbon>.5) r=turn(sin(t*.08)*.08,t*.035,sin(t*.07)*.06);
      vec3 p=r*aPosition;
      p.y+=sin(t*.25)*.055;
      vPosition=p; vNormal=r*aNormal; vLocal=aPosition; vDetail=aDetail;
      float aspect=uViewport.x/uViewport.y;
      float focal=2.75;
      if(aspect<.8) focal*=.68;
      float depth=5.4-p.z;
      float offset=aspect>1.05 ? .17 : 0.;
      gl_Position=vec4(p.x*focal/aspect+offset*depth,(p.y*focal+.08*depth),depth*.96-.2,depth);
    }
  `;
  const fragment = `
    precision highp float;
    uniform float uTime;
    uniform float uRibbon;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vLocal;
    varying vec3 vDetail;
    vec3 spectrum(float x) {
      return .55+.45*cos(6.2831853*(x+vec3(.0,.33,.67)));
    }
    float hash(vec3 p) {
      p=fract(p*.3183099+vec3(.1,.2,.3)); p*=17.;
      return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
    }
    float noise(vec3 p) {
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    vec3 studio(vec3 d) {
      d=normalize(d);
      float strip=exp(-pow((d.x+.27)/.14,2.))*pow(max(0.,d.y*.6+d.z*.8),9.);
      float rim=pow(max(0.,dot(d,normalize(vec3(-.8,.3,.6)))),44.);
      float top=pow(max(0.,dot(d,normalize(vec3(.4,1.,.3)))),19.);
      float side=pow(max(0.,dot(d,normalize(vec3(.9,-.2,.15)))),28.);
      float panel=pow(max(0.,dot(d,normalize(vec3(.6,.45,1.)))),34.);
      float back=pow(max(0.,dot(d,normalize(vec3(-.5,.6,-1.)))),32.);
      float filament=exp(-pow((d.y+.12+.13*sin(d.x*5.))/.022,2.))*pow(abs(d.z),4.);
      return vec3(.018,.025,.044)+vec3(.76,.84,1.)*strip*2.7+vec3(.79,.85,1.)*rim*1.6+vec3(.95,.97,1.)*top*1.8+vec3(.5,.39,.7)*side+vec3(.85,.91,1.)*panel*2.1+vec3(.75,.82,.94)*back*1.1+spectrum(d.x*.2+d.z*.1)*filament*.7;
    }
    void main() {
      if(uRibbon>.5) {
        float core=exp(-pow(vDetail.x*10.,2.));
        float bloom=exp(-pow(vDetail.x*2.8,2.))*.25;
        float pulse=.42+.58*pow(.5+.5*sin(vDetail.y*3.-uTime*.21+vDetail.z),2.);
        vec3 color=mix(vec3(.66,.76,.95),spectrum(vDetail.y*.16+vDetail.z*.21-uTime*.008),.48);
        float alpha=(core+bloom)*pulse;
        gl_FragColor=vec4(color*(1.15+core*.8),alpha*.88);
        return;
      }
      vec3 normal=normalize(vNormal);
      vec3 view=normalize(vec3(0.,0.,5.4)-vPosition);
      float facing=max(dot(normal,view),0.);
      float fresnel=pow(1.-facing,3.);
      vec3 reflected=reflect(-view,normal);
      vec3 refraction=vec3(studio(refract(-view,normal,.64)).r,studio(refract(-view,normal,.66)).g,studio(refract(-view,normal,.69)).b);
      vec3 internal=studio(reflect(refract(-view,normal,.66),normalize(normal+vec3(.35,-.25,-.6))));
      float grain=noise(vLocal*5.)*.65+noise(vLocal*13.)*.25+noise(vLocal*32.)*.10;
      float folds=pow(.5+.5*sin(vLocal.x*7.+vLocal.y*11.+grain*6.),18.);
      float fracture=pow(1.-abs(sin(vLocal.y*8.-vLocal.z*5.+grain*2.)),40.);
      vec3 tint=mix(vec3(.09,.13,.18),vec3(.4,.44,.5),grain*.5);
      vec3 color=tint*(.13+.1*facing)+refraction*.33+internal*.19;
      color+=studio(reflected)*(.3+fresnel*.85);
      color+=vec3(.35,.42,.52)*folds*.035+vec3(.4,.46,.55)*fracture*.055;
      vec3 iridescence=spectrum(facing*1.12+grain*.25+uTime*.009);
      color+=iridescence*(fresnel*.38+pow(max(0.,dot(reflected,normalize(vec3(-.5,.7,.5)))),60.)*.55);
      color+=vec3(.64,.72,.82)*pow(1.-facing,9.)*.48;
      color=vec3(1.)-exp(-color*1.8);
      color=pow(color,vec3(.85));
      gl_FragColor=vec4(color,1.);
    }
  `;

  const normalize = p => { const n=Math.hypot(...p); return p.map(v=>v/n); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function sculpture() {
    const g=(1+Math.sqrt(5))/2;
    const points=[[-1,g,0],[1,g,0],[-1,-g,0],[1,-g,0],[0,-1,g],[0,1,g],[0,-1,-g],[0,1,-g],[g,0,-1],[g,0,1],[-g,0,-1],[-g,0,1]].map(normalize);
    let faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]].map(face=>face.map(i=>points[i]));
    for(let depth=0;depth<4;depth++) {
      const next=[];
      for(const [a,b,c] of faces) {
        const ab=normalize(a.map((v,i)=>v+b[i])),bc=normalize(b.map((v,i)=>v+c[i])),ca=normalize(c.map((v,i)=>v+a[i]));
        next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
      }
      faces=next;
    }
    const deform=([x,y,z])=>{
      const r=1.12+.085*Math.sin(x*4.4+y*3.8)*Math.cos(z*4.5-y*2.)+.055*Math.sin(y*6.-z*3.);
      return [x*r,y*r*1.19,z*r*.94];
    };
    const data=[], smoothNormals=new Map();
    const key=p=>p.map(v=>v.toFixed(6)).join(',');
    const surfaces=faces.map(face=>{
      const p=face.map(deform);
      const flat=normalize(cross(p[1].map((v,i)=>v-p[0][i]),p[2].map((v,i)=>v-p[0][i])));
      face.forEach(v=>{const k=key(v),n=smoothNormals.get(k)||[0,0,0];smoothNormals.set(k,n.map((x,i)=>x+flat[i]));});
      return {p,flat,face};
    });
    for(const {p,flat,face} of surfaces) {
      p.forEach((v,i)=>{
        const smooth=normalize(smoothNormals.get(key(face[i])));
        const n=normalize(flat.map((value,j)=>value*.3+smooth[j]*.7));
        data.push(...v,...n,0,0,0);
      });
    }
    return new Float32Array(data);
  }
  function ribbons() {
    const data=[];
    for(let ring=0;ring<3;ring++) {
      const samples=240;
      const point=(t,side)=>{
        const radius=1.92+ring*.21;
        const x=radius*Math.cos(t), y=.38*Math.sin(t*2.+ring)*.35, z=radius*Math.sin(t);
        const tilt=[.46,-.66,1.14][ring];
        const py=y*Math.cos(tilt)-z*Math.sin(tilt),pz=y*Math.sin(tilt)+z*Math.cos(tilt);
        const twist=[-.31,.53,-.59][ring];
        const px=x*Math.cos(twist)-py*Math.sin(twist),yy=x*Math.sin(twist)+py*Math.cos(twist);
        const width=.048+ring*.012;
        return [px,yy+side*width,pz,0,0,1,side,t,ring];
      };
      for(let i=0;i<samples;i++) {
        const a=i/samples*Math.PI*2,b=(i+1)/samples*Math.PI*2;
        data.push(...point(a,-1),...point(b,-1),...point(a,1),...point(a,1),...point(b,-1),...point(b,1));
      }
    }
    return new Float32Array(data);
  }
  window.OorrCrystal = {
    create(canvas) {
      const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power',premultipliedAlpha:false});
      if(!gl) return null;
      let program,crystal,orbits,locations,active=false;
      const resources=[];
      function shader(type,source) {
        const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) {const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(error);}
        resources.push(['Shader',s]);return s;
      }
      function buffer(data) {
        const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
        resources.push(['Buffer',b]);return {buffer:b,count:data.length/9};
      }
      function setup() {
        resources.length=0;
        program=gl.createProgram();resources.push(['Program',program]);
        gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        locations={};
        ['uViewport','uPointer','uTime','uRibbon'].forEach(name=>locations[name]=gl.getUniformLocation(program,name));
        ['aPosition','aNormal','aDetail'].forEach(name=>locations[name]=gl.getAttribLocation(program,name));
        crystal=buffer(sculpture());orbits=buffer(ribbons());
        gl.clearColor(0,0,0,0);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);active=true;
      }
      function dispose() { resources.forEach(([type,item])=>gl['delete'+type](item));resources.length=0;active=false; }
      try { setup(); } catch(error) { dispose();return null; }
      const scene=canvas.closest('.cinema-scene');
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();active=false;scene.classList.remove('has-crystal');});
      canvas.addEventListener('webglcontextrestored',()=>{try {setup();canvas.dispatchEvent(new Event('crystalrestore'));} catch(error) {dispose();}});
      function draw(mesh) {
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
        ['aPosition','aNormal','aDetail'].forEach((name,i)=>{
          const location=locations[name];gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,36,i*12);
        });
        gl.drawArrays(gl.TRIANGLES,0,mesh.count);
      }
      return {
        resize(width,height,scale=1) {
          const mobile=width<821;
          const density=Math.min(devicePixelRatio||1,mobile?1.75:2);
          const cap=mobile?1500000:4000000;
          const dpr=Math.min(density,Math.sqrt(cap/(width*height)))*scale;
          canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));
        },
        render(time,pointer) {
          if(!active) return false;
          gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
          gl.uniform2f(locations.uViewport,canvas.clientWidth,canvas.clientHeight);
          gl.uniform2f(locations.uPointer,pointer.x,pointer.y);gl.uniform1f(locations.uTime,time);
          gl.disable(gl.BLEND);gl.depthMask(true);gl.uniform1f(locations.uRibbon,0);draw(crystal);
          gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
          gl.uniform1f(locations.uRibbon,1);draw(orbits);gl.depthMask(true);
          scene.classList.add('has-crystal');return true;
        }
      };
    }
  };
})();
