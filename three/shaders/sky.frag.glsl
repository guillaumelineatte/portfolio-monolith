varying vec3 vDir;
void main(){
  gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0);
}
