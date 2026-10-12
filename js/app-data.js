(function(){
  "use strict";

  const DEFAULT_STUDENTS = [
    {id:"6901",name:"ด.ช.มั่งมี ศรีวัน",dob:"2012-06-19"},
    {id:"6902",name:"ด.ช. นอนนิ่ง มีมั่ง",dob:"2012-06-20"},
    {id:"6903",name:"ด.ญ. รุ่งมานะ มีนา",dob:"2012-06-21"},
    {id:"6904",name:"ด.ญ. นารี งาม",dob:"2012-06-21"},
    {id:"6906",name:"ด.ญ.รามี สุขคี",dob:"2018-07-20"},
    {id:"6907",name:"ด.ญ.นาสุข ระพีใจ",dob:"2018-07-13"},
    {id:"6908",name:"ด.ช.พลมิระ นะสุข",dob:"2018-04-25"},
    {id:"6909",name:"ด.ช.พรรมพล กรรมกร",dob:"2018-04-05"}
  ];

  const SAMPLE_GAME = {
    id:"animal-direction",
    title:"Animal Direction Adventure",
    url:"./games/animal-direction/",
    image:"./assets/animal-direction-cover.png",
    description:"ฝึกการตอบสนองต่อทิศทาง บน ขวา ล่าง และซ้าย ผ่านเกมสนุก ๆ",
    supportsTelemetry:true,
    active:true
  };

  // ThaiW WebGL: launcher registration; score telemetry is not connected yet.
  const THAIW_GAME = {
    id:"thaiw-unity",
    title:"ThaiW — เกมคำศัพท์",
    url:"./games/ThaiW/",
    image:"./assets/thaiw-cover.svg",
    description:"เกม Unity WebGL (มีโหมดเกมภายใน)",
    supportsTelemetry:false,
    active:true
  };

  function readArray(key){
    try{
      const value=JSON.parse(localStorage.getItem(key)||"[]");
      return Array.isArray(value)?value:[];
    }catch(error){
      console.warn("[AppData] read failed",key,error);
      return [];
    }
  }

  function writeArray(key,value){
    localStorage.setItem(key,JSON.stringify(Array.isArray(value)?value:[]));
  }

  function makeId(prefix="id"){
    try{return `${prefix}-${crypto.randomUUID()}`}
    catch(_){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`}
  }

  function normalizeStudent(item={}){
    return {
      ...item,
      id:String(item.id||"").trim(),
      name:String(item.name||"").trim(),
      dob:String(item.dob||"").trim(),
      studentPhone:String(item.studentPhone||item.phone||"").trim(),
      guardianName:String(item.guardianName||"").trim(),
      guardianRelationship:String(item.guardianRelationship||"").trim(),
      guardianPhone:String(item.guardianPhone||"").trim(),
      address:String(item.address||"").trim(),
      active:item.active!==false,
      createdAt:item.createdAt||new Date().toISOString(),
      updatedAt:item.updatedAt||new Date().toISOString(),
      updatedBy:item.updatedBy||"system"
    };
  }

  function normalizeGame(item={}){
    const title=String(item.title||"").trim();
    const url=String(item.url||"").trim();
    const guessedAnimal=String(item.id||"")==="animal-direction"||/animal-direction/i.test(url)||title.toLowerCase()==="animal direction adventure";
    return {
      ...item,
      id:String(item.id||"").trim()||makeId("game"),
      title,
      url,
      image:String(item.image||item.image_url||"").trim(),
      description:String(item.description||"").trim(),
      supportsTelemetry:typeof item.supportsTelemetry==="boolean"?item.supportsTelemetry:guessedAnimal,
      active:item.active!==false,
      createdAt:item.createdAt||new Date().toISOString(),
      updatedAt:item.updatedAt||new Date().toISOString()
    };
  }

  function ensureSeedData(){
    const studentKeyExists=localStorage.getItem("students")!==null;
    let students=studentKeyExists?readArray("students").map(normalizeStudent):DEFAULT_STUDENTS.map(normalizeStudent);

    const gameKeyExists=localStorage.getItem("games")!==null;
    let games=gameKeyExists?readArray("games").map(normalizeGame):[normalizeGame(SAMPLE_GAME)];

    // Register the game also for existing browser installations. Do not
    // overwrite user edits, and do not re-add after the teacher deletes it.
    if(localStorage.getItem("thaiwGameRegisteredV1")!=="1"){
      if(!games.some(g=>g.id===THAIW_GAME.id)) games.push(normalizeGame(THAIW_GAME));
      localStorage.setItem("thaiwGameRegisteredV1","1");
    }

    // ย้ายข้อมูลจากรุ่นที่เคยมีสถานะ “ปิดใช้งาน” กลับมาเป็นรายการปกติ 1 ครั้ง
    // หลังจากรุ่นนี้ใช้การ “ลบ” แทนการปิดใช้งาน
    if(localStorage.getItem("deleteModeMigrationV1")!=="1"){
      students=students.map(s=>({...s,active:true}));
      games=games.map(g=>({...g,active:true}));
      localStorage.setItem("deleteModeMigrationV1","1");
    }

    writeArray("students",students);
    writeArray("games",games);
    ["usageHistory","gameResults"].forEach(k=>{
      if(localStorage.getItem(k)===null) writeArray(k,[]);
      else writeArray(k,readArray(k));
    });
    return {students,games};
  }


  function saveStudent(student,updatedBy="teacher"){
    const students=readArray("students").map(normalizeStudent);
    const normalized=normalizeStudent({...student,updatedAt:new Date().toISOString(),updatedBy});
    const index=students.findIndex(s=>String(s.id)===String(normalized.id));
    if(index===-1) students.push(normalized); else students[index]={...students[index],...normalized};
    writeArray("students",students);
    return normalized;
  }

  function setStudentActive(id,active,updatedBy="teacher"){
    const students=readArray("students").map(normalizeStudent);
    const index=students.findIndex(s=>String(s.id)===String(id));
    if(index===-1) return null;
    students[index]={...students[index],active:Boolean(active),updatedAt:new Date().toISOString(),updatedBy};
    writeArray("students",students);
    return students[index];
  }

  function saveGame(game){
    const games=readArray("games").map(normalizeGame);
    const normalized=normalizeGame({...game,updatedAt:new Date().toISOString()});
    const index=games.findIndex(g=>String(g.id)===String(normalized.id));
    if(index===-1) games.push(normalized); else games[index]={...games[index],...normalized};
    writeArray("games",games);
    return normalized;
  }

  function setGameActive(id,active){
    const games=readArray("games").map(normalizeGame);
    const index=games.findIndex(g=>String(g.id)===String(id));
    if(index===-1) return null;
    games[index]={...games[index],active:Boolean(active),updatedAt:new Date().toISOString()};
    writeArray("games",games);
    return games[index];
  }

  function deleteStudent(id){
    const students=readArray("students").map(normalizeStudent);
    const next=students.filter(s=>String(s.id)!==String(id));
    writeArray("students",next);
    return next.length!==students.length;
  }

  function deleteGame(id){
    const games=readArray("games").map(normalizeGame);
    const next=games.filter(g=>String(g.id)!==String(id));
    writeArray("games",next);
    return next.length!==games.length;
  }

  function findStudent(id){return readArray("students").map(normalizeStudent).find(s=>String(s.id)===String(id))||null}
  function findGame(id){return readArray("games").map(normalizeGame).find(g=>String(g.id)===String(id))||null}

  window.AppData={
    DEFAULT_STUDENTS,SAMPLE_GAME,readArray,writeArray,makeId,normalizeStudent,normalizeGame,
    ensureSeedData,saveStudent,setStudentActive,deleteStudent,saveGame,setGameActive,deleteGame,findStudent,findGame
  };

  ensureSeedData();
})();
