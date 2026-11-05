const assert = require('assert');
const { tokenize, Follower } = require('../src/matcher');
const { isQuestion, extractQuestion } = require('../src/detect');

const script = `Good morning everyone. Today I want to talk about our quarterly results and what they mean for the next year.
First, revenue grew twelve percent compared to last quarter. Second, our customer retention improved significantly across every region.`;
const words = tokenize(script);
const f = new Follower(words);
const at = (n) => words[n - 1].norm; // word just before the pointer

f.feed('good morning everyone today I want');            assert.strictEqual(at(f.pos), 'want');
f.feed('to talk about our quarterly results');           assert.strictEqual(at(f.pos), 'results');
f.feed('and what they mean for the next year');          assert.strictEqual(at(f.pos), 'year');
f.feed('first revenue grew twelve per cent');            assert.ok(['twelve', 'percent'].includes(at(f.pos)), at(f.pos));
f.feed('compared to the last quarter');                  assert.strictEqual(at(f.pos), 'quarter');
const before = f.pos; f.feed('uh um okay'); assert.strictEqual(f.pos, before);
f.feed('our customer retention improved significantly'); assert.strictEqual(at(f.pos), 'significantly');

assert.ok(isQuestion('What is your timeline for the rollout?'));
assert.ok(isQuestion('so how does this compare to last year'));
assert.ok(isQuestion('Thanks. Could you explain the retention number'));
assert.ok(!isQuestion('Great presentation, thank you very much.'));
assert.ok(!isQuestion('Okay.'));
assert.ok(extractQuestion('Nice. Thanks. Why did costs go up?').includes('Why did costs go up?'));
console.log('all tests passed');
