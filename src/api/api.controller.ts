import { errorCode } from '../lib/errorcode';
import { jwtsign, jwtverify } from '../lib/token';
import { checkAdmin } from '../lib/checkUser';
import { getConnection } from "typeorm";
import { Post } from '../entity/Post';
import { Crawl } from '../entity/Crawl';
import { Admin } from '../entity/Admin';
import { Media } from '../entity/Media';
import crypto from 'crypto';
import send from 'koa-send';
import short from 'short-uuid';
const mariadb = require('mariadb');

const connection = mariadb.createPool({
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database
});

const cryptoPassword = (async(password) => { return await crypto.createHmac('sha512', process.env.CRYPTO).update(password).digest('hex'); });
const translator = short(short.constants.flickrBase58, { consistentLength: false });


export const loadPost = (async (ctx) => {
  let { uid } = ctx.params;
  let body : object, status : number, post : object;

  if (uid !== undefined) {
    post = await getConnection()
    .createQueryBuilder()
    .select(["post.uid", "post.title", "post.date"])
    .from(Post, "post")
    .getMany();
  }else{
    post = await getConnection()
    .createQueryBuilder()
    .from(Post, "post")
    .where("post.uid = :uid", { uid: uid })
    .getOne();
  }

  if (post !== undefined) {    
    status = 200;
    body = post;
  }else{
    status = 403;
    body = await errorCode(303);
  }

  ctx.status = status;
  ctx.body = body;
});

export const loadLink = (async (ctx) => {
  let { pid } = ctx.params;
  let body : object, status : number, link : object;

  if (pid !== undefined) {
    link = await getConnection()
    .createQueryBuilder()
    .select(["crawl.uid", "crawl.title", "crawl.date"])
    .from(Crawl, "crawl")
    .where("crawl.page = :page", { page: pid })
    .getOne();

    if (link === undefined) {
      status = 403;
      body = await errorCode(303);
    }

    status = 200;
    body = link;
  }else{
    status = 412;
    body = await errorCode(402);
  }
  ctx.status = status;
  ctx.body = body;
});

export const uploadImage = (async (ctx) => { 
  const authentication = await jwtverify(ctx.header.authentication);
  const fileName = ctx.request.file != undefined ? ctx.request.file.filename : undefined;
  let body : object, status : number;

  if (fileName !== undefined) {
    if (authentication !== 'error') {
      const user = await checkAdmin(authentication[0]);


      if (user !== undefined) {
        const uid = await translator.new();
        await getConnection()
        .createQueryBuilder()
        .insert()
        .into(Media)
        .values({ 
          uid : uid,
          path: fileName })
        .execute();

        status = 201;
        body = {"uid" : uid};
      }else{
        status = 403;
        body = await errorCode(303);
      }
    }else{
      status = 412;
      body = await errorCode(302);
    }
  }else{
    status = 403;
    body = await errorCode(401, '파일 또는 파일 확장자 오류');
  }

  ctx.status = status;
  ctx.body = body;
});

export const loadImage = (async (ctx) => { 
  const { media } = ctx.params;
  let body : object, status : number;
  
  const path = await getConnection()
  .createQueryBuilder()
  .select("media")
  .from(Media, "media")
  .where("media.uid = :uid", { uid: media })
  .orWhere("media.path = :path", { path: media })
  .getOne();

  try { await send(ctx, path.path, { root: './files/' }); }
  catch(err){
    ctx.status = 404;
    ctx.body = await errorCode(501);
  }
});

export const adminLogin = (async (ctx) => { 
  const { id, password } = ctx.request.body;
  let body,status,accessToken;
  const admin = await getConnection()
  .createQueryBuilder()
  .select("admin")
  .from(Admin, "admin")
  .where("admin.id = :id", { id: id })
  .andWhere("admin.password = :password", { password: password })
  .getOne();

  if (admin !== undefined) {
    accessToken = await jwtsign(admin.id, '1y');

    status = 201;
    body = {  "accessToken" : accessToken };
  }else{
    status = 403;
    body = await errorCode(101);
  }

  ctx.status = status;
  ctx.body = body;
});
/*
export const writePost = (async (ctx) => {
  const firebaseToken = await verify(ctx.header.firebasetoken);
  const { description, mediaName } = ctx.request.body;
  let body : object, status : number;
  let array= "";

  if(firebaseToken !== 'error'){

    for await ( let tmp of mediaName ){
      array += tmp + ",";
    }

    await getConnection()
    .createQueryBuilder()
    .insert()
    .into(Post)
    .values({ userUid: firebaseToken[0], description: description, mediaName: array })
    .execute();

    status = 201;
    body = {};
  } else {
    status = 412;
    body = await errorCode(302);
  }
  ctx.status = status;
  ctx.body = body;
});

*/