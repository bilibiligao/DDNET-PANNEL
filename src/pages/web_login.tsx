import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Input } from '@heroui/input';
import { Button } from '@heroui/button';
import { Divider } from '@heroui/divider';
import { motion } from 'framer-motion';
import { LuLock } from 'react-icons/lu';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { setToken } from '@/store/modules/authSlice';
import { title } from '@/components/primitives';
import client from '@/api/client';

export default function WebLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const { data } = await client.post('/login', { password });
      dispatch(setToken(data.token));
      toast.success('登录成功');
      navigate('/', { replace: true });
    } catch (err: any) { toast.error(err.response?.data?.error || '登录失败'); }
    finally { setLoading(false); }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setRotate({ x: (e.clientY - rect.top - rect.height / 2) / 25, y: -(e.clientX - rect.left - rect.width / 2) / 25 });
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-black p-4'>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
        <div ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={() => setRotate({ x: 0, y: 0 })} style={{ perspective: '1000px' }}>
          <motion.div animate={{ rotateX: rotate.x, rotateY: rotate.y }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
            <Card className='relative overflow-hidden backdrop-blur-lg border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/20 dark:bg-black/40 w-96 max-w-full' shadow='none'>
              <div className='absolute rounded-full blur-[150px] filter dark:bg-[#2850ff] bg-[#ff4132] w-[100px] h-[100px] -top-10 -left-10 opacity-30' />
              <CardHeader className='flex flex-col gap-3 items-center pt-10 pb-0'>
                <div className='w-14 h-14 rounded-2xl bg-gradient-to-b from-[#FF72E1] to-[#F54C7A] flex items-center justify-center'>
                  <span className='text-white font-outfit font-bold text-xl'>DD</span>
                </div>
                <h1 className={title({ color: 'pink', size: 'xs' })}>DDNet Panel</h1>
                <p className='text-sm text-default-400'>mop server 管理面板</p>
              </CardHeader>
              <CardBody className='p-8 gap-4'>
                <Divider />
                <form onSubmit={handleLogin} className='flex flex-col gap-4'>
                  <Input type='password' label='管理员密码' placeholder='请输入密码' value={password} onValueChange={setPassword} startContent={<LuLock className='text-default-400' />} size='lg' isRequired autoFocus />
                  <Button type='submit' color='primary' size='lg' isLoading={loading} fullWidth radius='full' className='font-medium'>登录</Button>
                </form>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
