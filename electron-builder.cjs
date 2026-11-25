'use strict';
const {version,name}=require('./package.json');
const {INSTALL_DIRECTORY}=require('./designer/core/app-packaging.cjs');
if(name!==INSTALL_DIRECTORY)throw Error('WSET package name must match the dedicated install directory: '+INSTALL_DIRECTORY);
const isRC=/^\d+\.\d+\.\d+-rc\.\d+(?:\.\d+)*$/.test(version);
if(!isRC&&!/^\d+\.\d+\.\d+$/.test(version))throw Error('Unsupported WSET release version: '+version);
module.exports={
 appId:'no.rengelse.wset',productName:'WSET',executableName:'WSET',
 directories:{output:'dist',buildResources:'build'},
 extraResources:[{from:'build/wset-install-owner.txt',to:'wset-install-owner.txt'}],
 asar:true,asarUnpack:['node_modules/sharp/**/*','node_modules/@img/**/*','node_modules/ssh2/**/*'],
 files:['package.json','designer/**/*','!**/*.map','!**/.env*','!**/*.zip','!**/.wset-local-project.json','!**/storage/**','!**/private-data/**','!**/server-profiles/**'],
 win:{target:[{target:'nsis',arch:['x64']}],icon:'build/icon.ico',artifactName:'WSET-Setup-${version}.${ext}'},
 nsis:{oneClick:true,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:false,deleteAppDataOnUninstall:false,runAfterFinish:false,createDesktopShortcut:true,createStartMenuShortcut:true,include:'build/installer.nsh'},
 publish:[{provider:'github',owner:'rengelse',repo:'WSET',private:false,channel:'latest',releaseType:'release'}],
 // One distribution channel, including RC versions. Upload manually; never publish from npm.
 detectUpdateChannel:false,generateUpdatesFilesForAllChannels:false,
};
