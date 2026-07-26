-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum for progress status
DO $$ BEGIN
  CREATE TYPE public.progress_status AS ENUM ('new','learning','review','mastered');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- WORDS
CREATE TABLE public.words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simplified TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  pinyin_numeric TEXT,
  english_meaning TEXT NOT NULL,
  part_of_speech TEXT,
  classifier TEXT,
  example_sentence TEXT,
  example_translation TEXT,
  audio_url TEXT,
  audio_provider TEXT,
  audio_voice TEXT,
  source TEXT DEFAULT 'seed',
  source_license TEXT DEFAULT 'CC BY-SA 4.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.words (simplified);
CREATE INDEX ON public.words (pinyin);
GRANT SELECT ON public.words TO authenticated;
GRANT ALL ON public.words TO service_role;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "words readable by authenticated" ON public.words FOR SELECT TO authenticated USING (true);

-- LISTS
CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  list_type TEXT NOT NULL DEFAULT 'shared',
  version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lists TO authenticated;
GRANT ALL ON public.lists TO service_role;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lists readable by authenticated" ON public.lists FOR SELECT TO authenticated USING (true);

-- WORD_LISTS
CREATE TABLE public.word_lists (
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (word_id, list_id)
);
CREATE INDEX ON public.word_lists (list_id, position);
GRANT SELECT ON public.word_lists TO authenticated;
GRANT ALL ON public.word_lists TO service_role;
ALTER TABLE public.word_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "word_lists readable by authenticated" ON public.word_lists FOR SELECT TO authenticated USING (true);

-- USER_WORD_PROGRESS
CREATE TABLE public.user_word_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  status public.progress_status NOT NULL DEFAULT 'new',
  ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  interval_days NUMERIC NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  repetitions INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  pronunciation_correct_count INTEGER NOT NULL DEFAULT 0,
  pronunciation_incorrect_count INTEGER NOT NULL DEFAULT 0,
  meaning_correct_count INTEGER NOT NULL DEFAULT 0,
  meaning_incorrect_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, word_id)
);
CREATE INDEX ON public.user_word_progress (user_id, due_at);
CREATE INDEX ON public.user_word_progress (user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_word_progress TO authenticated;
GRANT ALL ON public.user_word_progress TO service_role;
ALTER TABLE public.user_word_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress select" ON public.user_word_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own progress insert" ON public.user_word_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress update" ON public.user_word_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress delete" ON public.user_word_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_progress_updated_at BEFORE UPDATE ON public.user_word_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STUDY_SESSIONS
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  new_words_count INTEGER NOT NULL DEFAULT 0,
  reviewed_words_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ON public.study_sessions (user_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions all" ON public.study_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- USER_SETTINGS
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_new_word_target INTEGER NOT NULL DEFAULT 5,
  default_list_id UUID REFERENCES public.lists(id),
  preferred_audio_speed NUMERIC(3,2) NOT NULL DEFAULT 0.85,
  streak_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings all" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create user_settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE default_list UUID;
BEGIN
  SELECT id INTO default_list FROM public.lists WHERE slug = 'hsk1' LIMIT 1;
  INSERT INTO public.user_settings (user_id, default_list_id)
  VALUES (NEW.id, default_list)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed lists
INSERT INTO public.lists (name, slug, description, list_type, version) VALUES
  ('HSK 1 — 2010', 'hsk1', 'Official HSK 1 vocabulary list (150 words).', 'hsk', '2010'),
  ('Greetings', 'greetings', 'Everyday greetings and polite phrases.', 'theme', '1'),
  ('Everyday basics', 'everyday', 'Common everyday nouns, adjectives and expressions.', 'theme', '1'),
  ('Common verbs', 'verbs', 'Frequently used HSK 1 verbs.', 'theme', '1');

-- 150 words
INSERT INTO public.words (simplified,pinyin,pinyin_numeric,english_meaning,part_of_speech,classifier,example_sentence,example_translation) VALUES
('爱','ài','ai4','to love; love','verb',NULL,NULL,NULL),
('八','bā','ba1','eight','numeral',NULL,NULL,NULL),
('爸爸','bàba','ba4ba5','dad; father','noun',NULL,NULL,NULL),
('杯子','bēizi','bei1zi5','cup; glass','noun','个',NULL,NULL),
('北京','Běijīng','Bei3jing1','Beijing','proper noun',NULL,NULL,NULL),
('本','běn','ben3','measure word for books','measure word',NULL,NULL,NULL),
('不','bù','bu4','no; not','adverb',NULL,NULL,NULL),
('不客气','bú kèqi','bu2 ke4qi5','you''re welcome','phrase',NULL,NULL,NULL),
('菜','cài','cai4','dish; vegetable','noun',NULL,NULL,NULL),
('茶','chá','cha2','tea','noun','杯',NULL,NULL),
('吃','chī','chi1','to eat','verb',NULL,'我想吃饭。','I want to eat.'),
('出租车','chūzūchē','chu1zu1che1','taxi','noun','辆',NULL,NULL),
('打电话','dǎ diànhuà','da3 dian4hua4','to make a phone call','phrase',NULL,NULL,NULL),
('大','dà','da4','big; large','adjective',NULL,NULL,NULL),
('的','de','de5','(possessive particle)','particle',NULL,NULL,NULL),
('点','diǎn','dian3','o''clock; a little','measure word',NULL,NULL,NULL),
('电脑','diànnǎo','dian4nao3','computer','noun','台',NULL,NULL),
('电视','diànshì','dian4shi4','television','noun','台',NULL,NULL),
('电影','diànyǐng','dian4ying3','movie','noun','部',NULL,NULL),
('东西','dōngxi','dong1xi5','thing; stuff','noun','个',NULL,NULL),
('都','dōu','dou1','all; both','adverb',NULL,NULL,NULL),
('读','dú','du2','to read','verb',NULL,NULL,NULL),
('对不起','duìbuqǐ','dui4bu5qi3','sorry; excuse me','phrase',NULL,NULL,NULL),
('多','duō','duo1','many; much','adjective',NULL,NULL,NULL),
('多少','duōshǎo','duo1shao3','how much; how many','pronoun',NULL,NULL,NULL),
('儿子','érzi','er2zi5','son','noun','个',NULL,NULL),
('二','èr','er4','two','numeral',NULL,NULL,NULL),
('饭馆','fànguǎn','fan4guan3','restaurant','noun','家',NULL,NULL),
('飞机','fēijī','fei1ji1','airplane','noun','架',NULL,NULL),
('分钟','fēnzhōng','fen1zhong1','minute','noun',NULL,NULL,NULL),
('高兴','gāoxìng','gao1xing4','happy; glad','adjective',NULL,NULL,NULL),
('个','gè','ge4','(general measure word)','measure word',NULL,NULL,NULL),
('工作','gōngzuò','gong1zuo4','work; job','noun/verb','份',NULL,NULL),
('狗','gǒu','gou3','dog','noun','只',NULL,NULL),
('汉语','Hànyǔ','Han4yu3','Chinese language','noun',NULL,NULL,NULL),
('好','hǎo','hao3','good; well','adjective',NULL,'你好。','Hello.'),
('号','hào','hao4','number; date','noun',NULL,NULL,NULL),
('喝','hē','he1','to drink','verb',NULL,'我喝茶。','I drink tea.'),
('和','hé','he2','and; with','conjunction',NULL,NULL,NULL),
('很','hěn','hen3','very','adverb',NULL,NULL,NULL),
('后面','hòumiàn','hou4mian4','behind; back','noun',NULL,NULL,NULL),
('回','huí','hui2','to return','verb',NULL,NULL,NULL),
('会','huì','hui4','can; to be able to','verb',NULL,NULL,NULL),
('几','jǐ','ji3','how many; several','pronoun',NULL,NULL,NULL),
('家','jiā','jia1','home; family','noun','个',NULL,NULL),
('叫','jiào','jiao4','to be called; to call','verb',NULL,'我叫小明。','My name is Xiao Ming.'),
('今天','jīntiān','jin1tian1','today','noun',NULL,NULL,NULL),
('九','jiǔ','jiu3','nine','numeral',NULL,NULL,NULL),
('开','kāi','kai1','to open; to turn on','verb',NULL,NULL,NULL),
('看','kàn','kan4','to look; to watch; to read','verb',NULL,'我看电影。','I watch a movie.'),
('看见','kànjiàn','kan4jian4','to see','verb',NULL,NULL,NULL),
('块','kuài','kuai4','(unit of currency); piece','measure word',NULL,NULL,NULL),
('来','lái','lai2','to come','verb',NULL,NULL,NULL),
('老师','lǎoshī','lao3shi1','teacher','noun','位',NULL,NULL),
('了','le','le5','(aspect particle)','particle',NULL,NULL,NULL),
('冷','lěng','leng3','cold','adjective',NULL,NULL,NULL),
('里','lǐ','li3','inside','noun',NULL,NULL,NULL),
('六','liù','liu4','six','numeral',NULL,NULL,NULL),
('妈妈','māma','ma1ma5','mom; mother','noun',NULL,NULL,NULL),
('吗','ma','ma5','(question particle)','particle',NULL,NULL,NULL),
('买','mǎi','mai3','to buy','verb',NULL,NULL,NULL),
('猫','māo','mao1','cat','noun','只',NULL,NULL),
('没关系','méi guānxi','mei2 guan1xi5','it doesn''t matter','phrase',NULL,NULL,NULL),
('没有','méiyǒu','mei2you3','to not have; there is not','verb',NULL,NULL,NULL),
('米饭','mǐfàn','mi3fan4','cooked rice','noun','碗',NULL,NULL),
('名字','míngzi','ming2zi5','name','noun','个',NULL,NULL),
('明天','míngtiān','ming2tian1','tomorrow','noun',NULL,NULL,NULL),
('哪','nǎ','na3','which','pronoun',NULL,NULL,NULL),
('哪儿','nǎr','nar3','where','pronoun',NULL,NULL,NULL),
('那','nà','na4','that','pronoun',NULL,NULL,NULL),
('呢','ne','ne5','(question particle)','particle',NULL,NULL,NULL),
('能','néng','neng2','can; be able to','verb',NULL,NULL,NULL),
('你','nǐ','ni3','you','pronoun',NULL,NULL,NULL),
('年','nián','nian2','year','noun',NULL,NULL,NULL),
('女儿','nǚ''ér','nu:3er2','daughter','noun','个',NULL,NULL),
('朋友','péngyou','peng2you5','friend','noun','个',NULL,NULL),
('漂亮','piàoliang','piao4liang5','pretty; beautiful','adjective',NULL,NULL,NULL),
('苹果','píngguǒ','ping2guo3','apple','noun','个',NULL,NULL),
('七','qī','qi1','seven','numeral',NULL,NULL,NULL),
('前面','qiánmiàn','qian2mian4','in front; front','noun',NULL,NULL,NULL),
('钱','qián','qian2','money','noun',NULL,NULL,NULL),
('请','qǐng','qing3','please; to invite','verb',NULL,NULL,NULL),
('去','qù','qu4','to go','verb',NULL,'我去学校。','I''m going to school.'),
('热','rè','re4','hot','adjective',NULL,NULL,NULL),
('人','rén','ren2','person','noun','个',NULL,NULL),
('认识','rènshi','ren4shi5','to know; to be acquainted with','verb',NULL,NULL,NULL),
('三','sān','san1','three','numeral',NULL,NULL,NULL),
('商店','shāngdiàn','shang1dian4','shop; store','noun','家',NULL,NULL),
('上','shàng','shang4','on; above; last','noun',NULL,NULL,NULL),
('上午','shàngwǔ','shang4wu3','morning','noun',NULL,NULL,NULL),
('少','shǎo','shao3','few; little','adjective',NULL,NULL,NULL),
('谁','shéi','shei2','who','pronoun',NULL,NULL,NULL),
('什么','shénme','shen2me5','what','pronoun',NULL,NULL,NULL),
('十','shí','shi2','ten','numeral',NULL,NULL,NULL),
('时候','shíhou','shi2hou5','time; moment','noun',NULL,NULL,NULL),
('是','shì','shi4','to be','verb',NULL,NULL,NULL),
('书','shū','shu1','book','noun','本',NULL,NULL),
('水','shuǐ','shui3','water','noun','杯',NULL,NULL),
('水果','shuǐguǒ','shui3guo3','fruit','noun',NULL,NULL,NULL),
('睡觉','shuìjiào','shui4jiao4','to sleep','verb',NULL,NULL,NULL),
('说','shuō','shuo1','to speak; to say','verb',NULL,NULL,NULL),
('四','sì','si4','four','numeral',NULL,NULL,NULL),
('岁','suì','sui4','year(s) of age','measure word',NULL,NULL,NULL),
('他','tā','ta1','he','pronoun',NULL,NULL,NULL),
('她','tā','ta1','she','pronoun',NULL,NULL,NULL),
('太','tài','tai4','too; very','adverb',NULL,NULL,NULL),
('天气','tiānqì','tian1qi4','weather','noun',NULL,NULL,NULL),
('听','tīng','ting1','to listen','verb',NULL,NULL,NULL),
('同学','tóngxué','tong2xue2','classmate','noun','位',NULL,NULL),
('喂','wèi','wei4','hello (on the phone)','interjection',NULL,NULL,NULL),
('我','wǒ','wo3','I; me','pronoun',NULL,NULL,NULL),
('我们','wǒmen','wo3men5','we; us','pronoun',NULL,NULL,NULL),
('五','wǔ','wu3','five','numeral',NULL,NULL,NULL),
('喜欢','xǐhuan','xi3huan5','to like','verb',NULL,NULL,NULL),
('下','xià','xia4','below; next','noun',NULL,NULL,NULL),
('下午','xiàwǔ','xia4wu3','afternoon','noun',NULL,NULL,NULL),
('下雨','xià yǔ','xia4 yu3','to rain','verb',NULL,NULL,NULL),
('先生','xiānsheng','xian1sheng5','Mr.; sir','noun','位',NULL,NULL),
('现在','xiànzài','xian4zai4','now','noun',NULL,NULL,NULL),
('想','xiǎng','xiang3','to want; to think','verb',NULL,NULL,NULL),
('小','xiǎo','xiao3','small','adjective',NULL,NULL,NULL),
('小姐','xiǎojiě','xiao3jie3','Miss','noun','位',NULL,NULL),
('些','xiē','xie1','some','measure word',NULL,NULL,NULL),
('写','xiě','xie3','to write','verb',NULL,NULL,NULL),
('谢谢','xièxie','xie4xie5','thanks','phrase',NULL,NULL,NULL),
('星期','xīngqī','xing1qi1','week','noun',NULL,NULL,NULL),
('学生','xuésheng','xue2sheng5','student','noun','名',NULL,NULL),
('学习','xuéxí','xue2xi2','to study','verb',NULL,NULL,NULL),
('学校','xuéxiào','xue2xiao4','school','noun','所',NULL,NULL),
('一','yī','yi1','one','numeral',NULL,NULL,NULL),
('一点儿','yìdiǎnr','yi4dianr3','a little','phrase',NULL,NULL,NULL),
('衣服','yīfu','yi1fu5','clothes','noun','件',NULL,NULL),
('医生','yīshēng','yi1sheng1','doctor','noun','位',NULL,NULL),
('医院','yīyuàn','yi1yuan4','hospital','noun','家',NULL,NULL),
('椅子','yǐzi','yi3zi5','chair','noun','把',NULL,NULL),
('有','yǒu','you3','to have','verb',NULL,NULL,NULL),
('月','yuè','yue4','month; moon','noun',NULL,NULL,NULL),
('再见','zàijiàn','zai4jian4','goodbye','phrase',NULL,NULL,NULL),
('在','zài','zai4','at; in; to be at','verb',NULL,NULL,NULL),
('怎么','zěnme','zen3me5','how','pronoun',NULL,NULL,NULL),
('怎么样','zěnmeyàng','zen3me5yang4','how about; how is it','phrase',NULL,NULL,NULL),
('这','zhè','zhe4','this','pronoun',NULL,NULL,NULL),
('中国','Zhōngguó','Zhong1guo2','China','proper noun',NULL,NULL,NULL),
('中午','zhōngwǔ','zhong1wu3','noon','noun',NULL,NULL,NULL),
('住','zhù','zhu4','to live; to reside','verb',NULL,NULL,NULL),
('桌子','zhuōzi','zhuo1zi5','table','noun','张',NULL,NULL),
('字','zì','zi4','character; word','noun','个',NULL,NULL),
('昨天','zuótiān','zuo2tian1','yesterday','noun',NULL,NULL,NULL),
('坐','zuò','zuo4','to sit','verb',NULL,NULL,NULL),
('做','zuò','zuo4','to do; to make','verb',NULL,NULL,NULL);

-- word_lists (position within each list)
INSERT INTO public.word_lists (word_id,list_id,position)
SELECT w.id, l.id, wl.position
FROM public.lists l
JOIN (VALUES
  ('hsk1','爱',0),('hsk1','八',1),('hsk1','爸爸',2),('hsk1','杯子',3),('hsk1','北京',4),('hsk1','本',5),('hsk1','不',6),('hsk1','不客气',7),('hsk1','菜',8),('hsk1','茶',9),
  ('hsk1','吃',10),('hsk1','出租车',11),('hsk1','打电话',12),('hsk1','大',13),('hsk1','的',14),('hsk1','点',15),('hsk1','电脑',16),('hsk1','电视',17),('hsk1','电影',18),('hsk1','东西',19),
  ('hsk1','都',20),('hsk1','读',21),('hsk1','对不起',22),('hsk1','多',23),('hsk1','多少',24),('hsk1','儿子',25),('hsk1','二',26),('hsk1','饭馆',27),('hsk1','飞机',28),('hsk1','分钟',29),
  ('hsk1','高兴',30),('hsk1','个',31),('hsk1','工作',32),('hsk1','狗',33),('hsk1','汉语',34),('hsk1','好',35),('hsk1','号',36),('hsk1','喝',37),('hsk1','和',38),('hsk1','很',39),
  ('hsk1','后面',40),('hsk1','回',41),('hsk1','会',42),('hsk1','几',43),('hsk1','家',44),('hsk1','叫',45),('hsk1','今天',46),('hsk1','九',47),('hsk1','开',48),('hsk1','看',49),
  ('hsk1','看见',50),('hsk1','块',51),('hsk1','来',52),('hsk1','老师',53),('hsk1','了',54),('hsk1','冷',55),('hsk1','里',56),('hsk1','六',57),('hsk1','妈妈',58),('hsk1','吗',59),
  ('hsk1','买',60),('hsk1','猫',61),('hsk1','没关系',62),('hsk1','没有',63),('hsk1','米饭',64),('hsk1','名字',65),('hsk1','明天',66),('hsk1','哪',67),('hsk1','哪儿',68),('hsk1','那',69),
  ('hsk1','呢',70),('hsk1','能',71),('hsk1','你',72),('hsk1','年',73),('hsk1','女儿',74),('hsk1','朋友',75),('hsk1','漂亮',76),('hsk1','苹果',77),('hsk1','七',78),('hsk1','前面',79),
  ('hsk1','钱',80),('hsk1','请',81),('hsk1','去',82),('hsk1','热',83),('hsk1','人',84),('hsk1','认识',85),('hsk1','三',86),('hsk1','商店',87),('hsk1','上',88),('hsk1','上午',89),
  ('hsk1','少',90),('hsk1','谁',91),('hsk1','什么',92),('hsk1','十',93),('hsk1','时候',94),('hsk1','是',95),('hsk1','书',96),('hsk1','水',97),('hsk1','水果',98),('hsk1','睡觉',99),
  ('hsk1','说',100),('hsk1','四',101),('hsk1','岁',102),('hsk1','他',103),('hsk1','她',104),('hsk1','太',105),('hsk1','天气',106),('hsk1','听',107),('hsk1','同学',108),('hsk1','喂',109),
  ('hsk1','我',110),('hsk1','我们',111),('hsk1','五',112),('hsk1','喜欢',113),('hsk1','下',114),('hsk1','下午',115),('hsk1','下雨',116),('hsk1','先生',117),('hsk1','现在',118),('hsk1','想',119),
  ('hsk1','小',120),('hsk1','小姐',121),('hsk1','些',122),('hsk1','写',123),('hsk1','谢谢',124),('hsk1','星期',125),('hsk1','学生',126),('hsk1','学习',127),('hsk1','学校',128),('hsk1','一',129),
  ('hsk1','一点儿',130),('hsk1','衣服',131),('hsk1','医生',132),('hsk1','医院',133),('hsk1','椅子',134),('hsk1','有',135),('hsk1','月',136),('hsk1','再见',137),('hsk1','在',138),('hsk1','怎么',139),
  ('hsk1','怎么样',140),('hsk1','这',141),('hsk1','中国',142),('hsk1','中午',143),('hsk1','住',144),('hsk1','桌子',145),('hsk1','字',146),('hsk1','昨天',147),('hsk1','坐',148),('hsk1','做',149),
  ('greetings','不客气',0),('greetings','对不起',1),('greetings','好',2),('greetings','叫',3),('greetings','没关系',4),('greetings','名字',5),('greetings','你',6),('greetings','请',7),('greetings','认识',8),('greetings','喂',9),
  ('greetings','我',10),('greetings','先生',11),('greetings','小姐',12),('greetings','谢谢',13),('greetings','再见',14),
  ('everyday','爸爸',0),('everyday','杯子',1),('everyday','菜',2),('everyday','茶',3),('everyday','吃',4),('everyday','大',5),('everyday','东西',6),('everyday','儿子',7),('everyday','高兴',8),('everyday','狗',9),
  ('everyday','好',10),('everyday','喝',11),('everyday','家',12),('everyday','今天',13),('everyday','看',14),('everyday','老师',15),('everyday','冷',16),('everyday','妈妈',17),('everyday','买',18),('everyday','猫',19),
  ('everyday','米饭',20),('everyday','明天',21),('everyday','你',22),('everyday','女儿',23),('everyday','朋友',24),('everyday','漂亮',25),('everyday','苹果',26),('everyday','钱',27),('everyday','去',28),('everyday','热',29),
  ('everyday','人',30),('everyday','商店',31),('everyday','上午',32),('everyday','书',33),('everyday','水',34),('everyday','水果',35),('everyday','睡觉',36),('everyday','他',37),('everyday','她',38),('everyday','天气',39),
  ('everyday','同学',40),('everyday','我',41),('everyday','我们',42),('everyday','喜欢',43),('everyday','下午',44),('everyday','下雨',45),('everyday','现在',46),('everyday','学生',47),('everyday','学习',48),('everyday','学校',49),
  ('everyday','衣服',50),('everyday','医生',51),('everyday','医院',52),('everyday','椅子',53),('everyday','中午',54),('everyday','桌子',55),('everyday','昨天',56),
  ('verbs','吃',0),('verbs','打电话',1),('verbs','读',2),('verbs','工作',3),('verbs','喝',4),('verbs','回',5),('verbs','会',6),('verbs','叫',7),('verbs','开',8),('verbs','看',9),
  ('verbs','看见',10),('verbs','来',11),('verbs','买',12),('verbs','没有',13),('verbs','能',14),('verbs','请',15),('verbs','去',16),('verbs','认识',17),('verbs','是',18),('verbs','睡觉',19),
  ('verbs','说',20),('verbs','听',21),('verbs','喜欢',22),('verbs','想',23),('verbs','写',24),('verbs','学习',25),('verbs','有',26),('verbs','在',27),('verbs','住',28),('verbs','坐',29),
  ('verbs','做',30)
) AS wl(list_slug, simplified, position) ON wl.list_slug = l.slug
JOIN public.words w ON w.simplified = wl.simplified;